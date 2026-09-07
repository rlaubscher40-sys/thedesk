/**
 * Turning an official time series into the history the monthly review reads.
 *
 * `monthlyReview` ranks a month by comparing the first and last reading inside
 * it, drawn from `daily_metric_history` — a row written every day carrying
 * whatever value was current that day. That works because the live ingest
 * records the *currently published* figure daily, so a month opens on last
 * month's number and closes on this month's.
 *
 * A backfill has to produce the same shape, or the review sees nothing.
 *
 * ## The modelling decision, and why the obvious version fails
 *
 * The obvious approach is to insert one history row per ABS observation. It
 * does not work: unemployment publishes monthly, so each month would hold a
 * single reading, and the review needs two to describe a move. Every backfilled
 * month would be silently skipped. Quarterly series are worse again.
 *
 * So an observation is treated as in force from a point after its period ends,
 * and the resulting step function is sampled at the first and last day of each
 * month.
 *
 * ## Publication lag, and why it is a parameter rather than a guess
 *
 * "After its period ends" is doing real work. ABS publishes the June labour
 * force figure in mid-July, so the live ingest — which records whatever is
 * currently published, daily — first sees June's number in July, and attributes
 * the move to July. A backfill with no lag puts the same move in June.
 *
 * That matters because backfilled and live rows share one table: get it wrong
 * and the month where they join shows a doubled or a missing move.
 *
 * The lag differs per series and this code has no way to know it, so it is
 * `publicationLagDays` and it defaults to 0. At 0 a move is attributed to the
 * period it describes, which is the honest reading of the data alone. Set it to
 * the real lag for a series (roughly 14 days for monthly labour force, roughly
 * 28 for quarterly CPI) and the backfill lines up with the live rows instead.
 * Worth setting when you wire a flow up, and worth not inventing before then.
 */
import type { AbsObservation } from "./absApi";

export type HistoryRow = { recordedAt: Date; value: number };

/** Last instant of the period an observation covers — the point from which its
 *  figure is the one in force. Handles the granularities ABS publishes. */
export function periodEnd(period: string): Date | null {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) {
    const endMonth = Number(quarter[2]) * 3; // Q1 → March
    return new Date(Date.UTC(Number(quarter[1]), endMonth, 0));
  }
  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (month) return new Date(Date.UTC(Number(month[1]), Number(month[2]), 0));
  const year = period.match(/^(\d{4})$/);
  if (year) return new Date(Date.UTC(Number(year[1]), 11, 31));
  const day = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return new Date(`${period}T00:00:00Z`);
  return null;
}

/** Months from `from` to `to` inclusive, as "YYYY-MM". */
function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth();
  // Guard against a reversed range producing an unbounded loop.
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/**
 * Convert observations into month-boundary history rows.
 *
 * `publicationLagDays` shifts when each observation is treated as known — see
 * the note above. It defaults to 0, which attributes a move to the period it
 * describes rather than to when the market learned it.
 *
 * Two rows per month rather than one per day: the review only reads the first
 * and last reading in a month, so a daily grid would multiply the row count by
 * fifteen to say the same thing. Decades of a metric cost a few hundred rows
 * this way.
 *
 * Months before the first observation are omitted rather than back-projected.
 * We do not know what the figure was before the series starts, and inventing a
 * flat run there would create fake "unchanged" months that drag down every
 * later month's sense of what normal looks like.
 */
export function observationsToHistory(
  observations: AbsObservation[],
  opts: { publicationLagDays?: number } = {}
): HistoryRow[] {
  const lagMs = (opts.publicationLagDays ?? 0) * 86_400_000;
  const points = observations
    .map((o) => {
      const end = periodEnd(o.period);
      return { at: end ? new Date(end.getTime() + lagMs) : null, value: o.value };
    })
    .filter((p): p is { at: Date; value: number } => p.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (points.length === 0) return [];

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rows: HistoryRow[] = [];

  /** The figure in force on a date: the most recent observation at or before
   *  it. Null before the series begins. */
  function valueAt(when: Date): number | null {
    let current: number | null = null;
    for (const p of points) {
      if (p.at.getTime() <= when.getTime()) current = p.value;
      else break;
    }
    return current;
  }

  for (const month of monthsBetween(first.at, last.at)) {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y!, m! - 1, 1));
    const monthEnd = new Date(Date.UTC(y!, m!, 0));
    const open = valueAt(monthStart);
    const close = valueAt(monthEnd);
    // A month before the first observation has no figure in force at its start.
    if (open === null || close === null) continue;
    rows.push({ recordedAt: monthStart, value: open });
    rows.push({ recordedAt: monthEnd, value: close });
  }
  return rows;
}
