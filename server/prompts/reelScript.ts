/**
 * The words the Reel says.
 *
 * The first version of the narration read the card aloud. That was the safe
 * choice and the wrong one: a voice that recites what is already on screen adds
 * nothing a reader could not get faster with the sound off. Ruben's brief is
 * that the audio should tell the story and explain the data, which means it has
 * to say things the card does not.
 *
 * So this is written by a model — and therefore fenced the same way
 * `generateStatLine` is fenced, because the whole position of the publication is
 * that its numbers are checkable and a voice stating a figure is exactly as
 * falsifiable as a card showing one.
 *
 * ## What it is allowed to do, and what it is not
 *
 * It may connect, order, characterise and explain *what the figures mean*: that
 * a run of four is unusual, that a reading sits near the top of its range, that
 * the typical month over this period was lower. All of those are restatements
 * of arithmetic already done in `statFacts.ts` and `statPick.ts`.
 *
 * It may not say why anything happened, what happens next, or state any figure
 * that is not in the facts it was handed. Causation and forecasting are the two
 * things it has no basis for, and a figure it invented is the one failure that
 * would cost more than the format is worth.
 *
 * Every line is checked against the source facts by `inventsFigures`. One bad
 * line fails the whole script, not just itself: a half-generated script mixes
 * two registers and reads worse than the plain one. The fallback is the
 * deterministic read in `narration.ts`, which is never wrong and never
 * interesting, and that is the right thing to be when the alternative is
 * unverified.
 */
import { invokeLLMJson } from "../core/llm";
import type { StatFact } from "../metrics/statFacts";
import { inventsFigures } from "./statCard";
import { rubenSystemPrompt, stripBannedChars } from "./voice";

export type ReelScriptStat = {
  label: string;
  value: string;
  line: string;
  subtext: string;
  context?: string | null;
  source?: string | null;
  direction?: "up" | "down" | "flat";
};

/**
 * The five spoken passages, in the order they play.
 *
 * They are keyed rather than positional because each one is timed against the
 * beat it plays over: `open` runs while only the metric's name is on screen,
 * `number` while the figure counts up, and so on. A missing key means that beat
 * plays silent rather than the whole clip shifting.
 */
export type ReelScriptLines = {
  /** Over the metric's name alone. The hook. The figure is not on screen yet. */
  open: string;
  /** Over the count-up. This is where the figure is said. */
  number: string;
  /** Over the sentence. What the figure means. */
  meaning: string;
  /** Over the claim. Why it is notable at all. */
  context: string;
  /** Over the supporting figures. The one that explains rather than states. */
  detail: string;
};

const KEYS: Array<keyof ReelScriptLines> = ["open", "number", "meaning", "context", "detail"];

/**
 * Spoken length caps, in characters.
 *
 * These are pacing, not formatting, and they are the only thing bounding how
 * long the clip runs: each beat holds a still frame for exactly as long as its
 * passage takes to say. The first set of caps allowed 700 characters, which is
 * a sixty-second Reel — measured, not guessed. A model writes to its cap, so a
 * loose cap is a long clip every time rather than occasionally.
 *
 * At a news read of about 2.6 words a second these sum to roughly twenty-two
 * seconds of speech and a clip a little under thirty. `scriptFitsClip` is the
 * backstop underneath them.
 */
export const MAX_CHARS: Record<keyof ReelScriptLines, number> = {
  open: 65,
  number: 45,
  meaning: 75,
  context: 65,
  detail: 95,
};

function buildPrompt(stat: ReelScriptStat, facts: StatFact[]): string {
  const direction =
    stat.direction === "flat" ? "unchanged" : stat.direction === "down" ? "fallen" : "risen";
  const factLines = facts.map((f) => `- ${f.figure} — ${f.caption}`).join("\n");
  return `You are writing the voice-over for a 20-second Instagram Reel from The Desk, an Australian property data publication. It is read aloud by a calm news presenter over a card showing the figure. Australian readers: property investors, brokers, analysts.

THESE ARE THE ONLY FACTS YOU HAVE. You may not use any other number.
- Metric: ${stat.label}
- Current value: ${stat.value}
- What makes it notable: ${stat.subtext}
- Latest move: ${direction}
- The sentence printed on the card: ${stat.line}
${stat.context ? `- Published context: ${stat.context}` : ""}
${stat.source ? `- Source: ${stat.source}` : ""}
${factLines ? `\nSupporting figures also printed on the card:\n${factLines}` : ""}

Write five short spoken passages. Return JSON only, with exactly these keys:

"open"    — Said while ONLY the metric's name is on screen. Set up why this number is worth ten seconds. Do NOT say the value; it has not appeared yet. Max ${MAX_CHARS.open} characters.
"number"  — Said as the figure counts up on screen. Say the value. Max ${MAX_CHARS.number} characters.
"meaning" — What the figure means for someone watching the market. Max ${MAX_CHARS.meaning} characters.
"context" — Why it is notable: the streak, the extreme, the threshold. Max ${MAX_CHARS.context} characters.
"detail"  — Said over the supporting figures. Explain what they add: how the reading sits against its range, against the typical reading, against the last one. This is the one that should teach the viewer something. Max ${MAX_CHARS.detail} characters.

Rules:
- Every figure you state must appear verbatim in the facts above. Inventing one is the single worst thing you can do here.
- Never say why it happened. You do not know why it happened.
- Never forecast, predict, or advise. No "expect", "likely", "should".
- Written to be HEARD, not read. Short sentences. No lists, no colons, no brackets, no headings.
- Australian English. Ruben's voice: calm, commercially sharp, understated. No hype, no emoji, no em dashes, no rhetorical questions.
- Do not name The Desk or ask anyone to follow. A separate closing line does that.

Output ONLY the JSON object.`;
}

/**
 * Every string the script is allowed to draw a figure from.
 *
 * Deliberately generous: the facts already on the card are fair game, because
 * the model was shown them and a viewer can read them. Anything outside this
 * list is a figure that exists nowhere in the source data.
 */
export function allowedFacts(stat: ReelScriptStat, facts: StatFact[]): string[] {
  return [
    stat.value,
    stat.subtext,
    stat.label,
    stat.line,
    stat.context ?? "",
    ...facts.flatMap((f) => [f.figure, f.caption]),
  ];
}

/**
 * Check a whole script. Returns the reason it failed, or null if it passed.
 *
 * Exported and returning a reason rather than a boolean so the rejection can be
 * logged with what was actually wrong — a script quietly replaced by the
 * fallback with no explanation is how a broken prompt survives for months.
 */
export function rejectScript(lines: Partial<ReelScriptLines>, facts: string[]): string | null {
  for (const key of KEYS) {
    const line = lines[key]?.trim();
    if (!line) return `${key} is missing`;
    if (line.length > MAX_CHARS[key])
      return `${key} is ${line.length} chars, over ${MAX_CHARS[key]}`;
    if (inventsFigures(line, facts)) return `${key} states a figure not in the source facts`;
  }
  return null;
}

/**
 * Generate the script, or return null to use the deterministic read.
 *
 * Never throws. Null is a normal outcome, not an error: no key, a bad response,
 * an over-long passage, a fabricated figure. The Reel still gets made and still
 * gets narrated, just plainly.
 */
export async function generateReelScript(
  stat: ReelScriptStat,
  facts: StatFact[]
): Promise<ReelScriptLines | null> {
  const allowed = allowedFacts(stat, facts);
  try {
    const raw = await invokeLLMJson<Partial<ReelScriptLines>>({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(stat, facts) },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 700,
    });
    const cleaned: Partial<ReelScriptLines> = {};
    for (const key of KEYS) {
      const value = raw[key];
      if (typeof value === "string") cleaned[key] = stripBannedChars(value).trim();
    }
    const reason = rejectScript(cleaned, allowed);
    if (reason) {
      console.warn(`[reelScript] rejected: ${reason}`);
      return null;
    }
    return cleaned as ReelScriptLines;
  } catch (err) {
    console.warn("[reelScript] generation failed:", (err as Error).message);
    return null;
  }
}
