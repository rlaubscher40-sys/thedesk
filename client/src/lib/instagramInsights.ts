/**
 * Which format is actually earning its slot.
 *
 * The account has been collecting reach, saves and shares per post for a while
 * and nothing has ever read them, so every decision about what to post has been
 * an argument rather than a measurement. This turns the rows the insights job
 * already writes into a per-format comparison.
 *
 * Three deliberate choices, because the naive version of this table would
 * mislead more than it informs:
 *
 *   1. **Rates, not totals.** A post shown to more people collects more of
 *      everything. Saves and shares are normalised per 1,000 reach so formats
 *      are compared on how strongly they land, not how far they happened to
 *      travel.
 *
 *   2. **Median, not mean.** One post going unusually wide should not become
 *      the format's reputation, in either direction.
 *
 *   3. **An explicit "not enough yet" state.** With a handful of posts these
 *      numbers are noise, and a confident-looking league table built on three
 *      rows is worse than no table. Below MIN_POSTS_FOR_SIGNAL the figures are
 *      still shown, because watching them accumulate is useful, but they are
 *      marked as not yet meaning anything.
 *
 * Saves are the headline rate: for evergreen reference content a save is the
 * strongest signal Instagram's ranking takes, and it is the one this account's
 * captions actually ask for.
 */
import {
  INSTAGRAM_POST_TYPES,
  INSTAGRAM_POST_TYPE_LABELS,
  type InstagramPostType,
} from "@shared/const";

/**
 * Posts below this per format are reported but flagged as inconclusive. Four
 * is not a statistical threshold, it is an honesty threshold: enough that a
 * single outlier no longer sets the median on its own.
 */
export const MIN_POSTS_FOR_SIGNAL = 4;

export type InsightRow = {
  postType: string;
  likes: number | null;
  comments: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  metricsFetchedAt: string | Date | null;
};

export type FormatSummary = {
  postType: InstagramPostType;
  /** Audience-facing name, the title the format wears on the grid. */
  label: string;
  /** Posts with usable metrics — the sample these figures rest on. */
  measured: number;
  /** Published but with no metrics yet, so excluded from every figure below.
   *  Surfaced so a format is never judged on data that has not landed. */
  awaiting: number;
  /** Median reach across measured posts. */
  medianReach: number | null;
  /** Median saves per 1,000 reach. The headline number. */
  savesPer1k: number | null;
  /** Median shares per 1,000 reach. */
  sharesPer1k: number | null;
  /** Median likes + comments per 1,000 reach. */
  engagementPer1k: number | null;
  /** False while `measured` is below MIN_POSTS_FOR_SIGNAL. */
  conclusive: boolean;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * A post counts as measured once the insights job has given it a reach figure.
 *
 * Reach is the denominator for every rate here, so a row without it cannot be
 * normalised at all. Zero reach is excluded for the same reason: it is a
 * division by zero, and in practice means the post is too new rather than that
 * nobody saw it.
 */
function isMeasured(row: InsightRow): boolean {
  return typeof row.reach === "number" && row.reach > 0;
}

/** Per 1,000 reach, or null when the numerator was never recorded. Missing and
 *  zero are different: "not fetched" must not read as "nobody saved it". */
function per1k(value: number | null, reach: number): number | null {
  if (typeof value !== "number") return null;
  return (value / reach) * 1000;
}

/** Drop the nulls so a metric absent on some posts doesn't sink the median for
 *  the posts that do have it. */
function medianOf(rows: Array<number | null>): number | null {
  return median(rows.filter((v): v is number => typeof v === "number"));
}

/**
 * Summarise every format, in the day's running order.
 *
 * Formats with no posts at all are included with zeroed counts rather than
 * omitted: "The Number has published nothing yet" is a real answer to the
 * question this table exists to answer, and silently dropping the row would
 * make a broken job look like a format that simply is not there.
 */
export function summariseFormats(rows: InsightRow[]): FormatSummary[] {
  return INSTAGRAM_POST_TYPES.map((postType) => {
    const mine = rows.filter((r) => r.postType === postType);
    const measured = mine.filter(isMeasured);

    return {
      postType,
      label: INSTAGRAM_POST_TYPE_LABELS[postType],
      measured: measured.length,
      awaiting: mine.length - measured.length,
      medianReach: median(measured.map((r) => r.reach!)),
      savesPer1k: medianOf(measured.map((r) => per1k(r.saved, r.reach!))),
      sharesPer1k: medianOf(measured.map((r) => per1k(r.shares, r.reach!))),
      engagementPer1k: medianOf(
        measured.map((r) => {
          if (typeof r.likes !== "number" && typeof r.comments !== "number") return null;
          return per1k((r.likes ?? 0) + (r.comments ?? 0), r.reach!);
        })
      ),
      conclusive: measured.length >= MIN_POSTS_FOR_SIGNAL,
    };
  });
}

/**
 * The one line the panel leads with, so the table has a reading rather than
 * leaving four rows of numbers to be interpreted fresh each time.
 *
 * Deliberately refuses to name a winner until at least two formats have enough
 * posts behind them AND the gap between them is wide enough to survive the
 * noise a sample this small carries. A 3% difference on five posts each is not
 * a finding, and reporting it as one is how a measurement tool starts doing
 * more harm than the guesswork it replaced.
 */
export function readFormats(summaries: FormatSummary[]): string {
  const ranked = summaries
    .filter((s) => s.conclusive && s.savesPer1k !== null)
    .sort((a, b) => b.savesPer1k! - a.savesPer1k!);

  if (ranked.length === 0) {
    const measured = summaries.reduce((n, s) => n + s.measured, 0);
    return measured === 0
      ? "No posts have engagement data yet. The insights job fills this in a day after each post."
      : `Not enough posts yet to compare formats. ${MIN_POSTS_FOR_SIGNAL} measured posts per format is the point where these numbers start meaning something.`;
  }

  const [best, second] = ranked;
  if (!second) {
    return `Only ${best!.label} has enough posts to read yet, at ${best!.savesPer1k!.toFixed(1)} saves per 1,000 reach.`;
  }

  // Below this the two are level as far as this sample can tell.
  const MEANINGFUL_GAP = 1.25;
  const ratio = second.savesPer1k! > 0 ? best!.savesPer1k! / second.savesPer1k! : Infinity;
  if (ratio < MEANINGFUL_GAP) {
    return `${best!.label} and ${second.label} are running level on saves. Nothing here justifies dropping either yet.`;
  }
  return `${best!.label} is earning ${ratio.toFixed(1)}x the saves per 1,000 reach that ${second.label} is.`;
}
