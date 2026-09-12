/**
 * Picks the one number worth a post today.
 *
 * The daily briefing carousel is a table of contents: three headlines, no
 * single hook. This module backs the opposite format — one metric, stated
 * large, with the reason it is interesting stated underneath. That reason has
 * to be real, so it is computed here from `daily_metric_history` rather than
 * asked for from a model.
 *
 * Every candidate is scored against four "why is this notable" angles:
 *
 *   streak    — consecutive moves the same way ("five straight falls")
 *   extreme   — highest / lowest in the window we hold
 *   jump      — today's move against this metric's own typical daily move
 *   threshold — crossed a round number that reads as a line in the sand
 *
 * The highest-scoring angle across all metrics wins. Scores are normalised so
 * a streak on the cash rate competes fairly with a jump in the ASX, and every
 * angle carries a `subtext` — the letterspaced mono line the card renders, and
 * the only factual claim the caption is allowed to make beyond the value
 * itself.
 *
 * Deliberately pure and synchronous: the caller loads metrics and histories,
 * this decides. That makes the editorial judgement unit-testable without a
 * database, an LLM, or the Graph API.
 */
import type { DailyMetric } from "../db/schema";

type StatAngleKind = "streak" | "extreme" | "jump" | "threshold" | "latest";

export type StatPick = {
  metricKey: string;
  /** Display label, "Auction clearance". */
  label: string;
  /** The hero string exactly as it should be set, "64.2%" / "$815,439". */
  value: string;
  /** Which of the four reasons earned it the slot. */
  angle: StatAngleKind;
  /**
   * The computed claim, already uppercase-ready for the mono subtext line.
   * "SEVEN RECORDED FALLS IN A ROW". This is ground truth: nothing
   * downstream may state a fact this line does not support.
   */
  subtext: string;
  /** Signed change against the previous reading, null when unknowable. */
  delta: number | null;
  /** Direction of the latest move. "flat" when unchanged or unknown. */
  direction: "up" | "down" | "flat";
  /** Editorial context from the metric row, if the ingest supplied one. */
  context: string | null;
  source: string | null;
  sourceUrl: string | null;
  asOf: Date;
  /** 0..1. The caller refuses to post below MIN_SCORE. */
  score: number;
  /** How many history points backed the decision. */
  sampleSize: number;
};

/**
 * Below this, nothing on the board is interesting enough to be worth a post.
 * A quiet day should produce silence, not a card announcing that the cash rate
 * did not move. The scores below are tuned so a genuine streak or a real
 * outlier clears it and routine drift does not.
 */
export const MIN_SCORE = 0.42;

/** Numbers this many days old are stale — the source stopped publishing, or
 *  the ingest broke. Either way it is not today's news. */
const MAX_AGE_DAYS = 10;

/** Fewer points than this and "highest in the window" means nothing. */
const MIN_HISTORY_FOR_EXTREME = 8;

/** Metrics whose day-to-day wobble is noise, not news. Excluded from the
 *  `jump` angle (a 0.3% move in AUD/USD is a Tuesday), though they remain
 *  eligible for streaks and extremes, which are wobble-resistant. */
const NOISY_KEYS = new Set(["audusd", "audgbp", "audeur", "asx200", "us10y"]);

/** Round numbers that read as a line in the sand when crossed. Keyed by
 *  metric; anything not listed simply never scores the threshold angle. */
const THRESHOLDS: Record<string, number[]> = {
  auction_clearance: [50, 55, 60, 65, 70],
  unemployment: [4, 4.5, 5, 5.5],
  cash_rate: [3, 3.5, 4, 4.5],
  cpi_trimmed: [2, 2.5, 3, 3.5],
  mortgage_arrears: [1, 1.25, 1.5, 2],
  consumer_confidence: [90, 95, 100],
};

export type HistoryPoint = { value: number; recordedAt: Date };

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** Spell small counts, so the subtext reads "SEVEN STRAIGHT" not "7 STRAIGHT".
 *  Above twelve the numeral is clearer than the word. */
function spell(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Strip display furniture so a value string can be compared numerically.
 *  Mirrors the parser the history writer uses, so the two agree on what a
 *  metric's number is. */
function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Whole days between two instants, floored and unsigned. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * History for a metric, oldest first, with same-day duplicates collapsed to
 * the last reading of each day. The ingest can run more than once in a day
 * (a manual re-run, a retry), and counting those repeats as separate moves
 * would inflate every streak.
 */
function dedupeByDay(points: HistoryPoint[]): HistoryPoint[] {
  const byDay = new Map<string, HistoryPoint>();
  for (const p of [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())) {
    byDay.set(p.recordedAt.toISOString().slice(0, 10), p);
  }
  return [...byDay.values()];
}

/** How many consecutive moves at the end of the series went the same way,
 *  and which way. Flat steps end a streak rather than extending it. */
function trailingStreak(values: number[]): { length: number; dir: "up" | "down" } | null {
  if (values.length < 3) return null;
  const moves: number[] = [];
  for (let i = 1; i < values.length; i++) moves.push(values[i]! - values[i - 1]!);
  const last = moves[moves.length - 1]!;
  if (last === 0) return null;
  const dir = last > 0 ? "up" : "down";
  let length = 0;
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i]!;
    if (m === 0 || m > 0 !== (dir === "up")) break;
    length++;
  }
  return length >= 3 ? { length, dir } : null;
}

/** Median absolute step, the yardstick a "jump" is measured against. Median
 *  rather than mean so one prior spike doesn't raise the bar for the next. */
function medianAbsStep(values: number[]): number | null {
  if (values.length < 4) return null;
  const steps: number[] = [];
  for (let i = 1; i < values.length; i++) steps.push(Math.abs(values[i]! - values[i - 1]!));
  const sorted = steps.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return med > 0 ? med : null;
}

/** Format a delta for prose: drops trailing zeros, keeps a sane precision for
 *  both index points (8210.43) and rates (4.35). */
function fmtDelta(n: number): string {
  const abs = Math.abs(n);
  const dp = abs >= 100 ? 0 : abs >= 1 ? 1 : 2;
  return abs.toFixed(dp).replace(/\.0+$/, "");
}

type Candidate = { angle: StatAngleKind; score: number; subtext: string };

/** Score the four angles for one metric and return the best, or null. */
function bestAngle(
  metric: DailyMetric,
  current: number,
  history: HistoryPoint[]
): Candidate | null {
  const series = dedupeByDay(history);
  const values = series.map((p) => p.value);
  // The live row is the newest reading; history may not have caught up.
  if (values[values.length - 1] !== current) values.push(current);

  const unit = metric.unit ?? "";
  const label = metric.label.toUpperCase();
  const out: Candidate[] = [];

  // ── streak ──────────────────────────────────────────────────────────────
  const streak = trailingStreak(values);
  if (streak) {
    const word = streak.dir === "up" ? "RISES" : "FALLS";
    out.push({
      angle: "streak",
      // Long streaks are the strongest story a metric can tell; saturates at
      // eight so a runaway series doesn't crowd out every other angle forever.
      score: Math.min(0.95, 0.4 + streak.length * 0.07),
      subtext: `${spell(streak.length).toUpperCase()} RECORDED ${word} IN A ROW`,
    });
  }

  // ── extreme ─────────────────────────────────────────────────────────────
  if (values.length >= MIN_HISTORY_FOR_EXTREME) {
    const prior = values.slice(0, -1);
    const max = Math.max(...prior);
    const min = Math.min(...prior);
    // Stored observations may have gaps and are not a complete release history.
    // Scope the claim to readings on file, never a calendar-wide record.
    if (current > max) {
      out.push({
        angle: "extreme",
        score: 0.78,
        subtext: `HIGHEST OF ${values.length} RECORDED READINGS`,
      });
    } else if (current < min) {
      out.push({
        angle: "extreme",
        score: 0.78,
        subtext: `LOWEST OF ${values.length} RECORDED READINGS`,
      });
    }
  }

  // ── jump ────────────────────────────────────────────────────────────────
  if (!NOISY_KEYS.has(metric.metricKey) && values.length >= 5) {
    const step = medianAbsStep(values.slice(0, -1));
    const move = current - values[values.length - 2]!;
    if (step && Math.abs(move) >= step * 3) {
      const ratio = Math.abs(move) / step;
      out.push({
        angle: "jump",
        // 3x typical is interesting, 8x is remarkable; cap so an artefact in
        // the data can't automatically win the day.
        score: Math.min(0.88, 0.45 + (ratio - 3) * 0.06),
        // A rate difference is percentage points; collection timestamps do
        // not establish the period over which the source's value changed.
        subtext: `${fmtDelta(move)}${unit === "%" ? "PP" : unit} BETWEEN READINGS, ${fmtDelta(ratio)}x THE MEDIAN RECORDED MOVE`,
      });
    }
  }

  // ── threshold ───────────────────────────────────────────────────────────
  const marks = THRESHOLDS[metric.metricKey];
  const prev = values.length >= 2 ? values[values.length - 2]! : null;
  if (marks && prev !== null) {
    for (const mark of marks) {
      const crossedDown = prev >= mark && current < mark;
      const crossedUp = prev <= mark && current > mark;
      if (crossedDown || crossedUp) {
        out.push({
          angle: "threshold",
          score: 0.72,
          subtext: `${label} CROSSED ${crossedDown ? "BELOW" : "ABOVE"} ${mark}${unit}`,
        });
        break;
      }
    }
  }

  if (out.length === 0) return null;
  return out.sort((a, b) => b.score - a.score)[0]!;
}

/**
 * Choose today's number. Returns null when nothing clears `MIN_SCORE` — the
 * caller treats that as "no post today", which is the correct outcome on a
 * quiet day and the reason this format stays worth following.
 *
 * `now` is injectable so the staleness check is testable.
 */
export function pickStatOfTheDay(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now: Date = new Date()
): StatPick | null {
  const picks: StatPick[] = [];

  for (const metric of metrics) {
    const current = parseNumeric(metric.value);
    if (current === null) continue;
    if (daysBetween(metric.asOf, now) > MAX_AGE_DAYS) continue;

    const history = histories[metric.metricKey] ?? [];
    const candidate = bestAngle(metric, current, history);
    if (!candidate || candidate.score < MIN_SCORE) continue;

    const prev = metric.previousValue ? parseNumeric(metric.previousValue) : null;
    const delta = prev === null ? null : current - prev;

    picks.push({
      metricKey: metric.metricKey,
      label: metric.label,
      value: metric.unit ? `${metric.value}${metric.unit}` : metric.value,
      angle: candidate.angle,
      subtext: candidate.subtext,
      delta,
      direction: delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down",
      context: metric.context,
      source: metric.source,
      sourceUrl: metric.sourceUrl,
      asOf: metric.asOf,
      score: candidate.score,
      sampleSize: dedupeByDay(history).length,
    });
  }

  if (picks.length === 0) return null;
  // Ties break towards the metric with more history behind it: the same score
  // means more when it is drawn from a longer series.
  return picks.sort((a, b) => b.score - a.score || b.sampleSize - a.sampleSize)[0]!;
}

/**
 * A number to rehearse with, on a day that has no news in it.
 *
 * The preview endpoint exists so a person can check the rendering and hear the
 * voice-over before either goes out unattended. On a quiet day
 * `pickStatOfTheDay` correctly returns null — that is the whole point of it,
 * and a Reel about nothing costs reach on the next one — but that also means
 * the rehearsal is unavailable exactly when somebody wants to use it, which is
 * usually right after a deploy.
 *
 * Note that lowering `MIN_SCORE` would achieve nothing: every angle scores at
 * least 0.45, so anything that scores at all already clears the bar. A null
 * means no metric had an *angle* — no streak, no extreme, no unusual jump, no
 * threshold crossed — so a rehearsal needs a claim of its own.
 *
 * That claim states only what is on file. It does not say the reading is high,
 * low, unusual or a first, because on a day like this it is none of those. The
 * card is honest about being a card with nothing to report, which is also the
 * most useful thing it can be while somebody is checking the typography.
 *
 * Only the preview calls this. The posting jobs call `pickStatOfTheDay` and
 * still publish nothing on a quiet day.
 */
export function rehearsalStat(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now: Date = new Date()
): StatPick | null {
  const real = pickStatOfTheDay(metrics, histories, now);
  if (real) return real;

  const candidates = metrics
    .map((metric) => {
      const current = parseNumeric(metric.value);
      if (current === null) return null;
      if (daysBetween(metric.asOf, now) > MAX_AGE_DAYS) return null;
      const series = dedupeByDay(histories[metric.metricKey] ?? []);
      return { metric, current, series };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    // The longest series makes the best rehearsal: it exercises the history
    // line and the supporting figures, which are the parts worth looking at.
    .sort((a, b) => b.series.length - a.series.length);

  const best = candidates[0];
  if (!best) return null;

  const prev = best.metric.previousValue ? parseNumeric(best.metric.previousValue) : null;
  const delta = prev === null ? null : best.current - prev;
  return {
    metricKey: best.metric.metricKey,
    label: best.metric.label,
    value: best.metric.unit ? `${best.metric.value}${best.metric.unit}` : best.metric.value,
    angle: "latest",
    subtext: `LATEST READING · ${best.series.length} ON FILE`,
    delta,
    direction: delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down",
    context: best.metric.context,
    source: best.metric.source,
    sourceUrl: best.metric.sourceUrl,
    asOf: best.metric.asOf,
    score: 0,
    sampleSize: best.series.length,
  };
}

/**
 * Why nothing was picked, in words a person can act on.
 *
 * "No metric cleared the bar" is true and unhelpful: it does not distinguish a
 * genuinely quiet day from an ingest that has stopped, and those need opposite
 * responses. This counts what was actually on the board.
 */
export function explainNoPick(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now: Date = new Date()
): string {
  if (metrics.length === 0) return "There are no metrics on the board at all.";
  const numeric = metrics.filter((m) => parseNumeric(m.value) !== null);
  const fresh = numeric.filter((m) => daysBetween(m.asOf, now) <= MAX_AGE_DAYS);
  const withHistory = fresh.filter((m) => (histories[m.metricKey] ?? []).length >= 2);

  if (fresh.length === 0) {
    return `All ${numeric.length} readable metrics are more than ${MAX_AGE_DAYS} days old — the ingest has stopped.`;
  }
  if (withHistory.length === 0) {
    return `${fresh.length} metrics are current but none has history behind it, so nothing can be compared to anything.`;
  }
  return (
    `${fresh.length} current metrics, ${withHistory.length} with history, and none of them moved ` +
    `in a way worth posting: no streak, no high or low, no unusual jump, no threshold crossed.`
  );
}
