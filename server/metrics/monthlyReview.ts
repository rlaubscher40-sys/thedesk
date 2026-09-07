/**
 * The month, told through our own numbers.
 *
 * We have been recording ~30 Australian macro and property series daily for a
 * year, and nothing has ever read that history editorially — the Trends page
 * works off editions, not off `daily_metric_history`. That basket, tracked
 * together over time, is the one genuinely proprietary thing this publication
 * owns. Individually the figures are public; nobody else holds this particular
 * set, sampled daily, in one place, which is what makes "here is what actually
 * moved this month" ours to publish and nobody else's to copy.
 *
 * ## Why ranking by percent change would be wrong
 *
 * A 3% move in the ASX is a quiet fortnight. A 3% move in the cash rate would
 * be the biggest monetary event in a decade. Ranking every series on the same
 * percentage scale would put currency noise above a rate decision every single
 * month.
 *
 * So each metric's move is measured against *its own* typical monthly move,
 * taken from the history we hold. A month that is three times a metric's normal
 * swing outranks one that is merely large in percentage terms. This is only
 * possible because we kept the history, which is the point.
 *
 * ## Why some metrics are never expressed in percent
 *
 * A cash rate going 4.00 to 4.35 is "35 basis points", not "up 8.75%". Stating
 * it the second way is technically true and reads as nonsense to anyone who
 * knows the subject. Metrics denominated in percent report percentage-point
 * moves; level metrics (an index, a dollar value) report percent.
 *
 * ## What this deliberately does not do
 *
 * It does not say whether a move was good. For this audience that is not a
 * property of the number: a falling median is good if you are buying and bad
 * if you are holding, which is exactly what the reader-position angles exist to
 * express. The review reports what moved and how unusually; the framing belongs
 * to the reader.
 */

export type ChangeKind = "points" | "percent";

export type MetricMove = {
  metricKey: string;
  label: string;
  unit: string | null;
  groupKey: string | null;
  /** First reading inside the month. */
  open: number;
  /** Last reading inside the month. */
  close: number;
  /** Signed change in the metric's own units. */
  change: number;
  /**
   * How the change should be stated. "points" for anything already denominated
   * in percent, where a relative change misleads; "percent" for levels.
   */
  changeKind: ChangeKind;
  /** Signed percent change. Null for point-denominated metrics, by design. */
  changePercent: number | null;
  direction: "up" | "down" | "flat";
  /**
   * This month's absolute move divided by this metric's own median monthly
   * move. 1.0 is an ordinary month, 3.0 is three times its usual swing. Null
   * when there is not enough history to say what ordinary looks like, or when
   * the metric has no normal move to divide by — see `brokeStillness`.
   */
  unusualness: number | null;
  /**
   * True when every prior month we hold shows this metric perfectly still, and
   * this month it moved.
   *
   * This is not "N times its usual month", because its usual month is zero and
   * the ratio is undefined. It is a different and stronger statement: the
   * metric does not move, and it just did. The cash rate is the obvious case —
   * it sits unchanged for months and its move is the most consequential thing
   * that can happen in this basket, so the arithmetic must not quietly drop it.
   */
  brokeStillness: boolean;
  /** Complete prior months backing `unusualness` or `brokeStillness`. */
  monthsOfHistory: number;
  /**
   * The most recent earlier month that moved further in the same direction,
   * as "2011-06". Null when nothing in the history we hold moved further.
   *
   * This is the claim the series exists to make: "the biggest monthly fall
   * since 2011" is worth reading, and "down 6.9%" on its own is not. It also
   * costs nothing to compute once the history is there.
   */
  biggestSince: string | null;
  /**
   * The earliest month we hold for this metric, as "2025-03".
   *
   * Carried so the copy can never overstate its reach. With `biggestSince`
   * null and a year of history, the true statement is "the biggest since we
   * started tracking in March 2025", not "the biggest on record". The
   * difference is the whole credibility of the series, and the temptation to
   * collapse it is exactly why the window travels with the claim.
   */
  historyStart: string | null;
};

export type MonthlyReview = {
  /** Sydney calendar month, "2026-08". */
  month: string;
  /** Display label, "August 2026". */
  label: string;
  /** Every metric that moved, most unusual first. */
  movers: MetricMove[];
  /** Metrics that did not move at all this month. Their stillness is often the
   *  story, so they are reported rather than dropped. */
  unchanged: MetricMove[];
  /** Metrics with a reading but too little history to rank. */
  unranked: MetricMove[];
};

export type HistoryPoint = { value: number; recordedAt: Date };

/** Prior complete months needed before "unusual" means anything. Three is the
 *  point at which a median stops being one number wearing a disguise. */
export const MIN_MONTHS_FOR_RANK = 3;

export type MetricMeta = {
  metricKey: string;
  label: string;
  unit: string | null;
  groupKey: string | null;
};

/** Sydney calendar month for an instant. Metrics roll over on the Sydney day,
 *  so the month boundary has to use the same zone or a reading taken late on
 *  the 31st lands in the wrong month. */
export function sydneyMonth(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** "2026-08" → "August 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Readings grouped by Sydney month, each month's readings in time order and
 *  collapsed to one per day. The ingest can run twice in a day (a retry, a hand
 *  re-run) and counting those repeats would distort both ends of the month. */
function byMonth(points: HistoryPoint[]): Map<string, number[]> {
  const perDay = new Map<string, HistoryPoint>();
  for (const p of [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())) {
    perDay.set(p.recordedAt.toISOString().slice(0, 10), p);
  }
  const out = new Map<string, number[]>();
  for (const p of perDay.values()) {
    const key = sydneyMonth(p.recordedAt);
    const bucket = out.get(key);
    if (bucket) bucket.push(p.value);
    else out.set(key, [p.value]);
  }
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * A metric already denominated in percent moves in percentage points, and
 * expressing that as a relative change ("the cash rate rose 8.75%") is the kind
 * of error that costs a publication its credibility with the readers who know
 * the subject best.
 */
function changeKindFor(unit: string | null): ChangeKind {
  return unit?.trim() === "%" ? "points" : "percent";
}

/**
 * Build one metric's month.
 *
 * Returns null when the month holds fewer than two readings — a single
 * reading cannot describe a move, and treating it as no change would report a
 * gap in the data as a fact about the market.
 */
function moveFor(
  meta: MetricMeta,
  months: Map<string, number[]>,
  targetMonth: string
): MetricMove | null {
  const readings = months.get(targetMonth);
  if (!readings || readings.length < 2) return null;

  const open = readings[0]!;
  const close = readings[readings.length - 1]!;
  const change = close - open;
  const changeKind = changeKindFor(meta.unit);

  // Typical monthly move, from complete prior months only. The target month is
  // excluded so a metric cannot be measured against itself, and the current
  // month is excluded from other metrics' baselines for the same reason.
  // Keep the month against each prior move: the magnitudes give "how unusual",
  // and the months give "since when", which is the more quotable of the two.
  const prior: Array<{ month: string; move: number }> = [];
  for (const [month, vals] of months) {
    if (month >= targetMonth || vals.length < 2) continue;
    prior.push({ month, move: vals[vals.length - 1]! - vals[0]! });
  }
  prior.sort((a, b) => a.month.localeCompare(b.month));
  const priorMoves = prior.map((p) => Math.abs(p.move));

  // Same direction only. "The biggest fall since 2011" is a claim about falls;
  // comparing a fall against an earlier rise of similar size would answer a
  // question nobody asked.
  const sameDirection = (m: number) => (change > 0 ? m > 0 : m < 0);
  const exceeded = prior.filter(
    (p) => sameDirection(p.move) && Math.abs(p.move) >= Math.abs(change)
  );
  const biggestSince = change === 0 ? null : (exceeded[exceeded.length - 1]?.month ?? null);
  const historyStart = prior[0]?.month ?? null;

  const typical = median(priorMoves);
  const enoughHistory = priorMoves.length >= MIN_MONTHS_FOR_RANK;
  // A metric whose every prior month was flat has no scale to be measured
  // against. That is the strongest signal available here, not a missing one.
  const brokeStillness =
    enoughHistory && typical === 0 && priorMoves.every((m) => m === 0) && change !== 0;
  const unusualness =
    enoughHistory && typical !== null && typical > 0 ? Math.abs(change) / typical : null;

  return {
    metricKey: meta.metricKey,
    label: meta.label,
    unit: meta.unit,
    groupKey: meta.groupKey,
    open,
    close,
    change,
    changeKind,
    changePercent: changeKind === "percent" && open !== 0 ? (change / open) * 100 : null,
    direction: change === 0 ? "flat" : change > 0 ? "up" : "down",
    unusualness,
    brokeStillness,
    monthsOfHistory: priorMoves.length,
    biggestSince,
    historyStart,
  };
}

/**
 * Summarise a month across the whole tracked basket.
 *
 * `month` defaults to the previous complete Sydney month, which is what a
 * review published on the 1st should cover. Reviewing the current month would
 * report a partial month as a finished one.
 */
export function buildMonthlyReview(
  metrics: MetricMeta[],
  histories: Record<string, HistoryPoint[]>,
  month?: string,
  now: Date = new Date()
): MonthlyReview {
  const target = month ?? previousMonth(sydneyMonth(now));

  const movers: MetricMove[] = [];
  const unchanged: MetricMove[] = [];
  const unranked: MetricMove[] = [];

  for (const meta of metrics) {
    const move = moveFor(meta, byMonth(histories[meta.metricKey] ?? []), target);
    if (!move) continue;
    if (move.direction === "flat") unchanged.push(move);
    else if (move.unusualness === null && !move.brokeStillness) unranked.push(move);
    else movers.push(move);
  }

  // A metric that broke a run of stillness outranks any ratio: nothing a
  // normally-moving series does is as informative as a normally-still one
  // moving at all. Among those, the longer the stillness the bigger the news.
  movers.sort((a, b) => {
    if (a.brokeStillness !== b.brokeStillness) return a.brokeStillness ? -1 : 1;
    if (a.brokeStillness && b.brokeStillness) return b.monthsOfHistory - a.monthsOfHistory;
    return (b.unusualness ?? 0) - (a.unusualness ?? 0);
  });
  // Alphabetical within the leftovers so the page does not reshuffle between
  // renders when nothing about the data has changed.
  unchanged.sort((a, b) => a.label.localeCompare(b.label));
  unranked.sort((a, b) => a.label.localeCompare(b.label));

  return { month: target, label: monthLabel(target), movers, unchanged, unranked };
}

/** "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

/** Format one move the way it should be said out loud. */
export function describeMove(move: MetricMove): string {
  const sign = move.change > 0 ? "+" : "";
  if (move.changeKind === "points") {
    const pts = Math.abs(move.change);
    const dp = pts < 1 ? 2 : 1;
    return `${sign}${move.change.toFixed(dp)} points`;
  }
  if (move.changePercent === null) return `${sign}${move.change}`;
  return `${sign}${move.changePercent.toFixed(1)}%`;
}

/**
 * How far back you have to go to find a bigger move in the same direction.
 *
 * Returns null when there is nothing worth saying. The two cases that matter:
 *
 *   · A bigger move exists in our window, so we can name its month, and the
 *     claim is unimpeachable because we hold the data behind it.
 *   · Nothing bigger exists. The honest statement is then bounded by when we
 *     started, NOT "the biggest ever". A year of history cannot support a
 *     record claim, and a series whose selling point is that its numbers are
 *     real cannot be the one that overstates its own reach.
 *
 * `minMonths` stops the bounded version firing on a window too short to be
 * interesting: "the biggest since we started tracking four months ago" is not
 * a fact anyone needs.
 */
export function describeReach(move: MetricMove, minMonths = 12): string | null {
  const direction = move.direction === "up" ? "rise" : "fall";
  if (move.biggestSince) {
    return `biggest ${direction} since ${monthLabel(move.biggestSince)}`;
  }
  if (move.historyStart && move.monthsOfHistory >= minMonths) {
    return `biggest ${direction} since we started tracking in ${monthLabel(move.historyStart)}`;
  }
  return null;
}

/**
 * The line the review leads with.
 *
 * Holds to the same rule as the other summaries on this site: it will not read
 * a month it does not have the history to read. A basket where nothing clears
 * its own normal range is a real finding — "a quiet month" — and worth saying
 * plainly rather than dressing the largest of several small moves as a story.
 */
export function readMonth(review: MonthlyReview): string {
  const { movers, unchanged, label } = review;
  if (movers.length === 0 && review.unranked.length === 0 && unchanged.length === 0) {
    return `No readings recorded for ${label}.`;
  }
  if (movers.length === 0) {
    return `Nothing in ${label} has enough history behind it to rank yet. The comparison needs ${MIN_MONTHS_FOR_RANK} complete prior months per metric.`;
  }

  const lead = movers[0]!;
  if (lead.brokeStillness) {
    return `${label}: ${lead.label} moved ${describeMove(lead)}, after ${lead.monthsOfHistory} months unchanged.`;
  }
  // A reach claim beats a ratio when we have one: "the biggest fall since 2011"
  // travels, "2.3 times its usual month" explains.
  const reach = describeReach(lead);
  if (reach) {
    return `${label}: ${lead.label} moved ${describeMove(lead)}, the ${reach}.`;
  }
  // Under about 1.5x its own normal swing, the biggest mover of the month is
  // just the biggest of a set of ordinary moves, which is not a story.
  if ((lead.unusualness ?? 0) < 1.5) {
    return `A quiet ${label}. Nothing in the basket moved far outside its own normal range.`;
  }
  return `${label}: ${lead.label} moved ${describeMove(lead)}, ${lead.unusualness!.toFixed(1)} times its usual month.`;
}
