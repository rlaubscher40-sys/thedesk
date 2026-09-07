/**
 * The supporting figures beside the headline one.
 *
 * Glasshouse's best-performing Reel — 1,319 likes and 996 shares against 566
 * and 293 for their narrated documentary — is not a story. It is a scan of one
 * building that puts seven specific numbers on screen: 87 sales found, 271.3m,
 * 75 floors, $2.2B to build, 146,500m², 82 homes, $1.2bn. Nothing about it is
 * narrative and there is no voice on it at all.
 *
 * The thing being copied here is therefore not the wireframe and not the voice.
 * It is density. One number is a claim and people scroll past claims; five
 * numbers about one subject is a reference, and a reference gets shared. Our
 * Reel had exactly one number in it.
 *
 * ## Every figure here is arithmetic on readings we hold
 *
 * No model writes any of this and nothing is looked up. Each fact is a
 * statement about the same series the card is already drawing, computed here
 * and printed as computed. A fact that cannot be computed from the readings in
 * hand is not shown — which is why the list is short on a young metric and
 * longer on an old one, and why `readings` counts what is actually there rather
 * than what we wish were there.
 */
import { formatLike, parseFigure } from "../og/figureFormat";
import type { SparkPoint } from "../og/sparkline";

/** A figure and the small line under it saying what it is. */
export type StatFact = { figure: string; caption: string };

/** Below this a range or an average is describing noise, not a metric. */
const MIN_FOR_STATS = 6;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/** "SINCE MAR 2024" — the honest start of what we hold, not a round number. */
function since(points: SparkPoint[]): string | null {
  const first = points[0];
  if (!first) return null;
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  })
    .format(first.at)
    .toUpperCase();
}

/**
 * Up to `max` supporting facts, most interesting first.
 *
 * Order is deliberate. The move against the last reading is the only one that
 * is *news*; the range and the typical value are what let a reader judge
 * whether the news is large; the count of readings is the archive itself, and
 * goes last because it is about us rather than about the metric.
 */
export function buildStatFacts(
  display: string,
  series: SparkPoint[],
  delta: number | null,
  max = 4
): StatFact[] {
  const shape = parseFigure(display);
  if (!shape) return [];
  const values = series.map((p) => p.value);
  const facts: StatFact[] = [];

  if (delta !== null && delta !== 0) {
    // The sign is the point, so it is written in rather than left to a minus
    // that reads as a hyphen at this size.
    const moved = formatLike({ ...shape, prefix: "" }, Math.abs(delta));
    facts.push({
      figure: `${delta > 0 ? "+" : "−"}${shape.prefix}${moved}`,
      caption: `${delta > 0 ? "Up" : "Down"} on the previous reading`,
    });
  }

  if (values.length >= MIN_FOR_STATS) {
    const low = Math.min(...values);
    const high = Math.max(...values);
    if (high !== low) {
      facts.push({
        figure: `${formatLike(shape, low)} — ${formatLike(shape, high)}`,
        caption: `Range across every reading we hold`,
      });
    }
    facts.push({
      figure: formatLike(shape, median(values)),
      caption: "Typical reading over the period",
    });
  }

  if (series.length > 0) {
    const start = since(series);
    facts.push({
      figure: series.length.toLocaleString("en-AU"),
      // The one fact that is about the archive rather than the metric, and the
      // one a publication aggregating today's headlines cannot print.
      caption: start ? `Readings behind this, since ${start}` : "Readings behind this",
    });
  }

  return facts.slice(0, max);
}
