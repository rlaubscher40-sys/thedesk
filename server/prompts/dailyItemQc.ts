/**
 * Second-pass editor for the per-item daily feed lines. The first pass
 * generates "say this", the four partner angles and "why it matters" in
 * isolation; this pass reads them together against the story and sharpens
 * what's flat, culls what's contrived, and catches voice tells the
 * generators missed. It's the daily-feed analogue of runEditorQc, which
 * already does this for the weekly edition.
 *
 * Two hard rules keep it safe:
 *   - It NEVER invents a line that the generator left null. A story that
 *     SKIPped say-this (no partner-channel angle) must not grow one here.
 *   - On any malformed or implausible output it falls back to the ORIGINAL
 *     value, never to null. QC is polish, a bad QC pass must not delete good
 *     content. The function never throws.
 */
import { PARTNER_TAG_LABELS, parsePartnerTag } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars, voiceRules } from "./voice";

export type DailyItemQcInput = {
  title: string;
  summary: string | null;
  category: string;
  articleText?: string | null;
  sayThis: string | null;
  partnerTag: string | null;
  whyItMatters: string | null;
};

export type DailyItemQcResult = {
  approved: boolean;
  notes: string[];
  sayThis: string | null;
  partnerTag: string | null;
  whyItMatters: string | null;
};

function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (judge whether the lines actually reflect the reporting):\n${text.slice(0, 4000)}\n`;
}

function buildPrompt(input: DailyItemQcInput): string {
  // Only the fields that exist get reviewed, and the editor is told which
  // ones may be touched so it can't resurrect a deliberately-skipped line.
  const present: string[] = [];
  if (input.sayThis != null) present.push("sayThis");
  if (input.partnerTag != null) present.push("partnerTag");
  if (input.whyItMatters != null) present.push("whyItMatters");

  return `You are the EDITOR doing a final read of the context lines stamped on a single daily feed story before it ships. The writer filed these in isolation; you see them together against the story. Tighten what's flat, cut what's contrived, fix any voice tell. Edits should be conservative, sharpen, don't rewrite for taste.

STORY
Title: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

LINES ON FILE (only these may be changed: ${present.join(", ") || "none"})
sayThis: ${input.sayThis ?? "(none)"}
partnerTag:
${input.partnerTag ?? "(none)"}
whyItMatters: ${input.whyItMatters ?? "(none)"}

---

${voiceRules}

---

Audit each line that is on file:

sayThis, the universal one-line conversation opener Ruben pastes into a client message.
- One sentence, max 28 words. Opens a conversation, does not recap the news. Lands a sharp commercial insight or implied action. Sounds like a sharp operator, not a press release.

partnerTag, four persona angles, EXACTLY these four labels in this order: ${PARTNER_TAG_LABELS.join(", ")}.
- Format every line as "Label: angle". One sentence each, max 20 words. Each must hook a specific, commercial conversation for that persona. Cut any line that is generic or contrived.

whyItMatters, the analytical so-what.
- One sentence, max 30 words. The consequence, signal, or thing to watch, NOT a recap. Concrete, no "this could have implications" filler.

CULLING: if a line is genuinely contrived or off-topic for the partner channel, set it to null rather than polishing weak content into existence. Note that sayThis and partnerTag travel together downstream, cull both or keep both, never split the pair. NEVER write a line for a field that is "(none)" on file, return null for it.

Output a SINGLE JSON object, NOTHING ELSE, no markdown fences, no preamble:

{
  "approved": true | false,
  "notes": ["one short note per edit, empty array if nothing changed"],
  "sayThis": "polished line, or null to cull, or the unchanged line",
  "partnerTag": "the four labelled lines separated by newlines, or null",
  "whyItMatters": "polished line, or null to cull, or the unchanged line"
}

If every line is already sharp, set approved=true, notes=[], and return each field unchanged. For any field that was "(none)", return null. Output valid JSON only, no trailing commas.`;
}

const SAY_THIS_MAX_CHARS = 280;
const WHY_MAX_CHARS = 320;

/** Polish-or-keep a single short line. A null revision culls it; an empty or
 *  implausibly long revision is rejected in favour of the original. */
function reconcileLine(
  original: string | null,
  revised: unknown,
  maxChars: number
): string | null {
  if (original == null) return null; // never resurrect a skipped line
  if (revised === null) return null; // editor culled it
  if (typeof revised !== "string") return original; // missing/odd, keep original
  const t = stripBannedChars(revised.trim()).replace(/^["']|["']$/g, "");
  if (!t || t.length > maxChars) return original;
  return t;
}

/** Same idea for the four-line partner block, but the revision must still
 *  parse to all four personas or we keep the original. */
function reconcileTag(original: string | null, revised: unknown): string | null {
  if (original == null) return null;
  if (revised === null) return null;
  if (typeof revised !== "string") return original;
  const cleaned = stripBannedChars(revised.trim());
  return parsePartnerTag(cleaned) ? cleaned : original;
}

function fallback(input: DailyItemQcInput): DailyItemQcResult {
  return {
    approved: true,
    notes: [],
    sayThis: input.sayThis,
    partnerTag: input.partnerTag,
    whyItMatters: input.whyItMatters,
  };
}

/**
 * Run the daily-item QC pass. Best-effort: returns the polished lines, or the
 * originals on any failure. Never throws, never nulls a line except when the
 * editor explicitly culls one.
 */
export async function runDailyItemQc(
  input: DailyItemQcInput
): Promise<DailyItemQcResult> {
  // Nothing to review.
  if (input.sayThis == null && input.partnerTag == null && input.whyItMatters == null) {
    return fallback(input);
  }

  let content: string;
  try {
    content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(input) },
      ],
      maxTokens: 1_500,
    });
  } catch (err) {
    console.warn("[daily-qc] LLM failed, keeping originals:", (err as Error).message);
    return fallback(input);
  }

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: { approved?: unknown; notes?: unknown; sayThis?: unknown; partnerTag?: unknown; whyItMatters?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    console.warn("[daily-qc] invalid JSON, keeping originals:", content.slice(0, 160));
    return fallback(input);
  }

  return {
    approved: parsed.approved === true,
    notes: Array.isArray(parsed.notes) ? parsed.notes.filter((n): n is string => typeof n === "string") : [],
    sayThis: reconcileLine(input.sayThis, parsed.sayThis, SAY_THIS_MAX_CHARS),
    partnerTag: reconcileTag(input.partnerTag, parsed.partnerTag),
    whyItMatters: reconcileLine(input.whyItMatters, parsed.whyItMatters, WHY_MAX_CHARS),
  };
}
