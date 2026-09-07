/**
 * Writes the one sentence that sits under the number on a stat card.
 *
 * The number, and the reason it is notable, are both computed in
 * `server/instagram/statPick.ts` from our own metric history. This prompt does
 * one narrow job: turn that computed claim into a sentence a person would say
 * out loud. It is not asked to analyse, predict, or explain causation, because
 * it has no basis for any of those and a card that guesses is worse than no
 * card.
 *
 * The output is then checked against the facts it was given: any figure in the
 * sentence that did not appear in the input is treated as fabrication and the
 * whole rewrite is discarded in favour of the deterministic fallback. Our
 * credibility on this format rests on every number tracing back to a source
 * row, so the guard is not optional and failing closed is the right default.
 */
import { invokeLLM } from "../core/llm";
import type { StatPick } from "../instagram/statPick";
import { rubenSystemPrompt, stripBannedChars } from "./voice";

/** Above this the line stops fitting the card's serif block at a readable size. */
const MAX_LINE_CHARS = 96;

/**
 * Every distinct run of digits in a string, normalised so "1,179" and "1179"
 * compare equal and "6.0" matches "6.0". Trailing zeros after a decimal point
 * are dropped so "6.0" and "6" are the same figure, which they are.
 */
function numberTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const cleaned = raw.replace(/,/g, "");
    const normalised = cleaned.includes(".")
      ? cleaned.replace(/0+$/, "").replace(/\.$/, "")
      : cleaned;
    out.add(normalised);
  }
  return out;
}

/**
 * True when `line` states a figure that none of the source facts contain.
 * Spelled-out numerals are left alone: the model is told to spell small counts,
 * and "five straight falls" is already carried by the computed subtext.
 */
export function inventsFigures(line: string, facts: string[]): boolean {
  const allowed = numberTokens(facts.join(" "));
  for (const token of numberTokens(line)) {
    if (!allowed.has(token)) return true;
  }
  return false;
}

/**
 * The safe line, used whenever the model is unavailable, off-voice, or wrong.
 * Plain, accurate, and never embarrassing.
 *
 * It states the direction rather than the value, for the same reason the prompt
 * above forbids the model from stating the value: the figure is already set at
 * up to 400px directly overhead. The old fallback broke that rule, which was
 * invisible on the grid card and obvious on the 9:16 frame, where "Auction
 * clearance is now 52.5%" sat under a vast "52.5%" with the supporting figures
 * beneath it.
 */
export function fallbackStatLine(pick: StatPick): string {
  if (pick.direction === "up") return `${pick.label} is higher than it was.`;
  if (pick.direction === "down") return `${pick.label} is lower than it was.`;
  return `${pick.label} did not move.`;
}

function buildPrompt(pick: StatPick): string {
  const direction =
    pick.direction === "flat" ? "unchanged" : pick.direction === "up" ? "risen" : "fallen";
  return `You are writing the single sentence that sits beneath a large number on The Desk's Instagram stat card, read by Australian property and finance professionals.

THESE ARE THE ONLY FACTS YOU HAVE:
- Metric: ${pick.label}
- Current value: ${pick.value}
- What makes it notable: ${pick.subtext}
- Latest move: ${direction}
${pick.context ? `- Published context: ${pick.context}` : ""}
${pick.source ? `- Source: ${pick.source}` : ""}

Write ONE sentence that says what this number means, in plain words a person would say out loud.

Rules:
- 8 to 16 words. Never more than ${MAX_LINE_CHARS} characters.
- State only what the facts above support. Do not add a figure, a date, a place, a cause, or a forecast that is not in them.
- Do not explain why it happened. You do not know why it happened.
- Do not repeat the value itself. It is already set large directly above your sentence.
- Spell small numbers as words. Australian English.
- Ruben's voice: calm, commercially sharp, understated. No hype, no emoji, no em dashes, no question marks, no quotation marks.
- End with a full stop.

Output ONLY the sentence. No preamble, no label, no quotes.`;
}

/**
 * Generate the card's sentence. Never throws and never returns something
 * unverified: on any failure, over-length output, or a fabricated figure, the
 * deterministic fallback is returned instead, so the card always renders and
 * always tells the truth.
 */
export async function generateStatLine(pick: StatPick): Promise<string> {
  const facts = [pick.value, pick.subtext, pick.context ?? "", pick.label];
  try {
    const content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(pick) },
      ],
      maxTokens: 160,
    });
    const cleaned = stripBannedChars(content.trim())
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!cleaned) return fallbackStatLine(pick);
    if (cleaned.length > MAX_LINE_CHARS) {
      console.log(`[statCard] rejected (${cleaned.length} chars): ${cleaned.slice(0, 80)}`);
      return fallbackStatLine(pick);
    }
    if (inventsFigures(cleaned, facts)) {
      console.warn(`[statCard] rejected (figure not in source facts): ${cleaned}`);
      return fallbackStatLine(pick);
    }
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  } catch (err) {
    console.error("[statCard] generation error:", (err as Error).message);
    return fallbackStatLine(pick);
  }
}
