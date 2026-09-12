/** Shared spoken-passage types and source-figure validation for Reel scripts.
 * Automatic recipes supply reviewed scripts; there is no runtime LLM generator here.
 */
import type { StatFact } from "../metrics/statFacts";
import { inventsFigures } from "./statCard";

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
const MAX_CHARS: Record<keyof ReelScriptLines, number> = {
  open: 65,
  number: 45,
  meaning: 75,
  context: 65,
  detail: 95,
};

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
