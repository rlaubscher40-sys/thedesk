/**
 * Single-call daily enrichment. Produces ALL of an item's context lines —
 * partnerTag, sayThis, whyItMatters, counterpoint — in one LLM round-trip.
 *
 * Why this exists: the batch enrichment used to fire four separate generators
 * per story and then a fifth "editor QC" pass, each call re-sending the full
 * article text (up to ~6000 chars / ~1500 tokens). That's the same article
 * paid for five times per story, the dominant driver of input-token spend.
 *
 * Generating the four angles together in one pass is also strictly better for
 * quality, not worse: the model sees the whole story and all four lines at
 * once, which is exactly what the separate QC pass was bolted on to do —
 * read the lines together, sharpen the flat one, cull the contrived one. So
 * the culling/voice rules that lived in runDailyItemQc are folded in here.
 *
 * The per-angle rules below are kept verbatim from the standalone generators
 * (sayThis.ts, partnerTag.ts, whyItMatters.ts, counterpoint.ts) and the editor
 * (dailyItemQc.ts), which remain in use for the lower-volume on-demand and
 * Instagram paths. If you change an angle's rules, change it in both places.
 */
import { PARTNER_TAG_LABELS, parsePartnerTag } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { rubenSystemPrompt, stripBannedChars, voiceRules } from "./voice";

export type DailyAnglesInput = {
  title: string;
  summary: string | null;
  category: string;
  articleText?: string | null;
};

export type DailyAngles = {
  partnerTag: string | null;
  sayThis: string | null;
  whyItMatters: string | null;
  counterpoint: string | null;
};

const SAY_THIS_MAX_CHARS = 280;
const WHY_MAX_CHARS = 320;
const COUNTERPOINT_MAX_CHARS = 280;

/** Hand the model the full article once. Every angle mines the same text, so
 *  it appears a single time in the prompt instead of once per generator. */
function articleBlock(articleText: string | null | undefined): string {
  const text = articleText?.trim();
  if (!text) return "";
  return `\n\nFull article text (mine this for the specific detail the headline buries — a figure, a named party, a rule change, a stated consequence — and ground every angle in it, not the generic headline):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: DailyAnglesInput): string {
  return `You are writing — and then editing — the full set of context lines stamped on a single daily feed story for The Desk, an intelligence brief read by Australian property and finance professionals (mortgage brokers, financial advisers, accountants, buyer's agents). Write all four lines, see them together, and only keep the ones that genuinely earn their place.

STORY
Title: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

---

${voiceRules}

---

Produce these four fields. Each has its own bar; a field that does not clear its bar is null, never padded with contrived content.

1) sayThis — the universal one-line conversation opener Ruben pastes into a client message or a LinkedIn comment.
   - FIRST decide whether the story is genuinely commercially relevant to the partner channel: property, mortgages, lending, regulation, macro / markets, super, ATO, RBA, APRA — the kind of thing a broker or adviser actually raises with a client. If it is sport, entertainment, lifestyle, celebrity, true crime, weather, or any beat with NO real partner-channel angle, set sayThis to null. Do not invent a contrived angle.
   - Otherwise: ONE sentence, max 28 words. Opens a conversation without explaining the news itself. Lands a sharp commercial insight or implied action. Sounds like a sharp operator, not a press release.

2) partnerTag — three partner-role angles. Travels TOGETHER with sayThis: if sayThis is null (no partner-channel angle), partnerTag is null too. Keep both or cull both, never split the pair.
   - EXACTLY three lines, one per role, each "Label: angle", in this order:
     ${PARTNER_TAG_LABELS[0]}: one sentence, max 20 words, for mortgage brokers focused on borrowing capacity and lending
     ${PARTNER_TAG_LABELS[1]}: one sentence, max 20 words, for financial advisers and accountants focused on wealth strategy, tax structure and SMSF
     ${PARTNER_TAG_LABELS[2]}: one sentence, max 20 words, for buyer's agents and property professionals
   - Each line must hook a specific, commercial conversation for that role, not a generic restatement of the news.

3) whyItMatters — the analytical so-what, shown on every story card. This one has a LOWER bar than the partner angles: most stories get it, even general news.
   - ONE sentence, max 30 words: the consequence, the signal, or the specific thing to watch next. NOT a recap of the headline. Concrete and specific; no "this could have implications" filler.
   - Only set it to null if the story is genuinely trivial with no broader significance (pure celebrity gossip, sport scores, weather).

4) counterpoint — the calm contrarian read.
   - ONE sentence, max 28 words: the non-obvious tension, the bear case, or the assumption the consensus might have wrong. It must genuinely complicate the obvious read, not restate it.
   - Most stories have no real second side — set counterpoint to null rather than manufacture one.

Then edit your own work: tighten anything flat, fix any voice tell, and null anything that reads contrived or off-topic rather than polishing weak content into existence.

Output a SINGLE JSON object, NOTHING ELSE — no markdown fences, no preamble, no commentary:

{
  "sayThis": "the line, or null",
  "partnerTag": "the three labelled lines separated by newlines, or null",
  "whyItMatters": "the line, or null",
  "counterpoint": "the line, or null"
}

Use real JSON null (not the string "null", not "SKIP") for any field that does not clear its bar. No trailing commas. Australian English throughout.`;
}

/** Clean and length-check a single line; empty/over-long/SKIP collapses to null. */
function cleanLine(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const t = stripBannedChars(value.trim()).replace(/^["']|["']$/g, "");
  if (!t || t.length > maxChars) return null;
  if (/^SKIP\.?$/i.test(t)) return null;
  return t;
}

/** Validate the three-line partner block; anything that doesn't parse to all
 *  three roles collapses to null (same guard the standalone generator uses). */
function cleanTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripBannedChars(value.trim());
  if (!cleaned || /^SKIP\.?$/i.test(cleaned)) return null;
  return parsePartnerTag(cleaned) ? cleaned : null;
}

const EMPTY: DailyAngles = {
  partnerTag: null,
  sayThis: null,
  whyItMatters: null,
  counterpoint: null,
};

/**
 * Generate all four daily angles in one call. Best-effort: on any failure
 * (network, malformed JSON) it returns all-null, matching how the standalone
 * generators each resolve null on error — the caller persists only the
 * non-null fields, so a bad run simply leaves gaps rather than throwing.
 */
export async function generateDailyAngles(input: DailyAnglesInput): Promise<DailyAngles> {
  let content: string;
  try {
    content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(input) },
      ],
      maxTokens: 900,
    });
  } catch (err) {
    console.error("[dailyAngles] generation error:", (err as Error).message);
    return EMPTY;
  }

  let json = content.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();

  let parsed: {
    sayThis?: unknown;
    partnerTag?: unknown;
    whyItMatters?: unknown;
    counterpoint?: unknown;
  };
  try {
    parsed = JSON.parse(json);
  } catch {
    console.warn("[dailyAngles] invalid JSON, dropping all angles:", content.slice(0, 160));
    return EMPTY;
  }

  // The pairing of sayThis + partnerTag (keep both or cull both) is enforced
  // in the prompt as an editorial decision. Here we only validate shape: a
  // field the model genuinely wrote but that fails parsing is dropped on its
  // own, matching the standalone generators (which persist independently and
  // let the card render whichever survived).
  return {
    sayThis: cleanLine(parsed.sayThis, SAY_THIS_MAX_CHARS),
    partnerTag: cleanTag(parsed.partnerTag),
    whyItMatters: cleanLine(parsed.whyItMatters, WHY_MAX_CHARS),
    counterpoint: cleanLine(parsed.counterpoint, COUNTERPOINT_MAX_CHARS),
  };
}
