/**
 * Copy for "The Month in Numbers" — the monthly post built from our own
 * metric history.
 *
 * Same contract as the daily stat card, for the same reason: the figures and
 * the claim about them are computed in `server/metrics/monthlyReview.ts`, and
 * the model's only job is to turn a computed fact into a sentence. Its output
 * is then checked against the facts it was given, and any figure that was not
 * among them is treated as fabrication and discarded for a deterministic line.
 *
 * This series is the one thing this publication can offer that a competitor
 * cannot copy, and that is worth nothing if a number on it is invented.
 */
import { invokeLLM } from "../core/llm";
import type { MetricMove, MonthlyReview } from "../metrics/monthlyReview";
import { describeMove, describeReach } from "../metrics/monthlyReview";
import { inventsFigures } from "./statCard";
import { rubenSystemPrompt, stripBannedChars } from "./voice";

/** Above this the line stops fitting the card's serif block at a readable size. */
const MAX_LINE_CHARS = 96;

/**
 * How a move's notability should be stated, in the card's mono subtext slot.
 *
 * Ordered by how much a reader gets from it. "The biggest fall since 2011"
 * travels and needs no explaining; "2.3x its usual month" is precise but asks
 * the reader to do a little work. So a reach claim wins when the history
 * supports one, and the ratio is the fallback rather than the default.
 */
export function moveClaim(move: MetricMove): string {
  if (move.brokeStillness) {
    return `FIRST MOVE IN ${move.monthsOfHistory} MONTHS`;
  }
  const reach = describeReach(move);
  if (reach) return reach.toUpperCase();
  if (move.unusualness !== null) {
    return `${move.unusualness.toFixed(1)}x ITS USUAL MONTH`;
  }
  return "MOVED THIS MONTH";
}

/** Where the metric finished the month, formatted the way it is normally read. */
function closeLevel(move: MetricMove): string {
  if (move.unit?.trim() === "%") return `${move.close.toFixed(2)}%`;
  const rounded = Math.abs(move.close) >= 100 ? Math.round(move.close) : move.close;
  return rounded.toLocaleString("en-AU", { maximumFractionDigits: 4 });
}

/**
 * The safe line, used whenever the model is unavailable, off-voice, or wrong.
 *
 * States the level the metric finished on rather than restating the move. The
 * move is already the hero directly above and the claim about it is directly
 * below, so a fallback that repeats either of them wastes the only line on the
 * card that can add anything. The closing level is computed, so this stays as
 * checkable as everything else here.
 */
export function fallbackMonthLine(move: MetricMove, review: MonthlyReview): string {
  return `It finished ${review.label.split(" ")[0]} at ${closeLevel(move)}.`;
}

function buildPrompt(move: MetricMove, review: MonthlyReview): string {
  const reach = describeReach(move);
  const notable = move.brokeStillness
    ? `It had not moved at all in the ${move.monthsOfHistory} months before this.`
    : reach
      ? `It is the ${reach}.`
      : move.unusualness !== null
        ? `That is ${move.unusualness.toFixed(1)} times this metric's own usual monthly move.`
        : "";
  return `You are writing the single sentence beneath a large number on The Desk's monthly card, in a series called The Month in Numbers. It is read by people who follow Australian property closely and have money or a home in it.

THESE ARE THE ONLY FACTS YOU HAVE:
- Month: ${review.label}
- Metric: ${move.label}
- Move across the month: ${describeMove(move)}
- Direction: ${move.direction === "up" ? "up" : "down"}
${notable ? `- Why it stands out: ${notable}` : ""}

Write ONE sentence saying what this move means, in plain words a person would say out loud.

Rules:
- 8 to 16 words. Never more than ${MAX_LINE_CHARS} characters.
- State only what the facts above support. Do not add a figure, a date, a place, a cause, or a forecast that is not in them.
- Do not explain why it happened. You do not know why it happened.
- Do not repeat the move itself. It is already set large directly above your sentence.
- Do not say whether this is good or bad. For this audience it depends on whether they are buying or holding, and the card does not take that side.
- Spell small numbers as words. Australian English.
- Ruben's voice: calm, commercially sharp, understated. No hype, no emoji, no em dashes, no question marks, no quotation marks.
- End with a full stop.

Output ONLY the sentence. No preamble, no label, no quotes.`;
}

/**
 * Generate one card's sentence. Never throws and never returns something
 * unverified: on any failure, over-length output, or a fabricated figure, the
 * deterministic fallback is returned instead.
 */
export async function generateMonthLine(move: MetricMove, review: MonthlyReview): Promise<string> {
  const facts = [
    describeMove(move),
    move.label,
    review.label,
    moveClaim(move),
    String(move.monthsOfHistory),
  ];
  try {
    const content = await invokeLLM({
      messages: [
        { role: "system", content: rubenSystemPrompt },
        { role: "user", content: buildPrompt(move, review) },
      ],
      maxTokens: 160,
    });
    const cleaned = stripBannedChars(content.trim())
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!cleaned) return fallbackMonthLine(move, review);
    if (cleaned.length > MAX_LINE_CHARS) {
      console.log(`[monthCard] rejected (${cleaned.length} chars): ${cleaned.slice(0, 80)}`);
      return fallbackMonthLine(move, review);
    }
    if (inventsFigures(cleaned, facts)) {
      console.warn(`[monthCard] rejected (figure not in source facts): ${cleaned}`);
      return fallbackMonthLine(move, review);
    }
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  } catch (err) {
    console.error("[monthCard] generation error:", (err as Error).message);
    return fallbackMonthLine(move, review);
  }
}
