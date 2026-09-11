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
import { READER_ANGLE_LABELS, parseReaderAngles } from "../../shared/schemas";
import { invokeLLM } from "../core/llm";
import { editorialTimeContext, validEditorialAngle } from "../../shared/editorialTiming";
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
  return `\n\nExtracted publisher text (may be an excerpt, never assume it is complete; mine this for the specific detail the headline buries — a figure, a named party, a rule change, a stated consequence — and ground every angle in it, not the generic headline):\n${text.slice(0, 6000)}\n`;
}

function buildPrompt(input: DailyAnglesInput): string {
  return `You are writing — and then editing — the full set of context lines stamped on a single daily feed story for The Desk, a daily briefing on Australian property and the markets around it.

Its readers follow the market closely and have money or a home in it. Some are trying to buy, some already own, some are watching to time a move. They are smart and time-poor. They are NOT industry professionals working a client book, so never write to a broker, an adviser or an agent, and never frame a line as something to say to a client.

Write all four fields, see them together, and only keep the ones that genuinely earn their place.

STORY
Title: ${input.title}
Category: ${input.category}
Summary: ${input.summary || "(no summary)"}${articleBlock(input.articleText)}

---

${voiceRules}

---

Produce these four fields. Each has its own bar; a field that does not clear its bar is null, never padded with contrived content.

1) sayThis — the hook. The sharpest single line on the story, and the first thing someone sees on social before deciding whether to keep reading. Written to the reader, not about them.
   - FIRST decide whether the story genuinely bears on Australian property or the money around it: prices, rates, lending, rents, supply, construction, regulation, tax, and macro or markets where they reach housing. If it is sport, entertainment, lifestyle, celebrity, true crime, weather, or any beat with NO real bearing on that, set sayThis to null. Do not invent a contrived angle.
   - Otherwise: ONE sentence, max 28 words. Says what the story means without re-reporting what happened. Lands the non-obvious read or the consequence. Sounds like a sharp person telling you the point over coffee, not a headline and not a pitch. Never instructs the reader to do something.

2) partnerTag — three reader angles, one per position. Travels TOGETHER with sayThis: if sayThis is null, this is null too. Keep both or cull both, never split the pair.
   - EXACTLY three lines, one per position, each "Label: angle", in this order:
     ${READER_ANGLE_LABELS[0]}: one sentence, max 20 words, for someone actively trying to buy — what it changes about price, competition, borrowing power or timing
     ${READER_ANGLE_LABELS[1]}: one sentence, max 20 words, for someone who already owns — what it changes about repayments, rent, equity or the value of what they hold
     ${READER_ANGLE_LABELS[2]}: one sentence, max 20 words, for someone watching to time a move — what signal this is, and what would confirm it
   - The three must genuinely differ. Saying the same thing three ways is a failure: find what is actually different between the positions, or null the field.

3) whyItMatters — the analytical so-what, shown on every story card. This one has a LOWER bar than the reader angles: most stories get it, even general news.
   - ONE sentence, max 30 words: the consequence, the signal, or the specific thing to watch next. NOT a recap of the headline. Concrete and specific; no "this could have implications" filler.
   - Only set it to null if the story is genuinely trivial with no broader significance (pure celebrity gossip, sport scores, weather).

4) counterpoint — the calm contrarian read.
   - ONE sentence, max 28 words: the non-obvious tension, the bear case, or the assumption the consensus might have wrong. It must genuinely complicate the obvious read, not restate it.
   - Most stories have no real second side — set counterpoint to null rather than manufacture one.

Then edit your own work: tighten anything flat, fix any voice tell, and null anything that reads contrived or off-topic rather than polishing weak content into existence.

Output a SINGLE JSON object, NOTHING ELSE — no markdown fences, no preamble, no commentary:

{
  "sayThis": "the line, or null",
  "partnerTag": "the three labelled reader-angle lines separated by newlines, or null",
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

/** Validate the three-line reader-angles block; anything that doesn't parse to all
 *  three roles collapses to null (same guard the standalone generator uses). */
function cleanTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripBannedChars(value.trim());
  if (!cleaned || /^SKIP\.?$/i.test(cleaned)) return null;
  return parseReaderAngles(cleaned) ? cleaned : null;
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
 * Durable workers opt into strict failures and supply a cancellation deadline.
 */
export async function generateDailyAngles(
  input: DailyAnglesInput,
  options: { strict?: boolean; signal?: AbortSignal } = {}
): Promise<DailyAngles> {
  let content: string;
  try {
    content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: `${editorialTimeContext()}\n\n${buildPrompt(input)}` },
      ],
      maxTokens: 900,
      signal: options.signal,
      ...(options.strict ? { maxRetries: 0 } : {}),
    });
  } catch (err) {
    if (options.strict) throw new Error("Daily angle generation failed");
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
    if (options.strict) throw new Error("Invalid daily angle response");
    console.warn("[dailyAngles] invalid JSON, dropping all angles");
    return EMPTY;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    ["sayThis", "partnerTag", "whyItMatters", "counterpoint"].some((key) => {
      const value = (parsed as Record<string, unknown>)[key];
      return value !== null && typeof value !== "string";
    })
  ) {
    if (options.strict) throw new Error("Invalid daily angle response shape");
    return EMPTY;
  }

  // The pairing of sayThis + partnerTag (keep both or cull both) is enforced
  // in the prompt as an editorial decision. Here we only validate shape: a
  // field the model genuinely wrote but that fails parsing is dropped on its
  // own, matching the standalone generators (which persist independently and
  // let the card render whichever survived).
  return {
    sayThis: validEditorialAngle(cleanLine(parsed.sayThis, SAY_THIS_MAX_CHARS)),
    partnerTag: validEditorialAngle(cleanTag(parsed.partnerTag)),
    whyItMatters: validEditorialAngle(cleanLine(parsed.whyItMatters, WHY_MAX_CHARS)),
    counterpoint: validEditorialAngle(cleanLine(parsed.counterpoint, COUNTERPOINT_MAX_CHARS)),
  };
}
