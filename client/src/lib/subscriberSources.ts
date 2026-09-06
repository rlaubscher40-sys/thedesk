/**
 * Where subscribers actually came from.
 *
 * `subscribers.source` has always recorded which form converted someone. This
 * groups them by `arrivalSource` instead — the channel that brought them to
 * the site — which is the number that decides whether Instagram is an
 * acquisition channel or a hobby.
 *
 * The one thing this has to get right is the start date. Attribution was added
 * partway through the list's life, so every subscriber before it has a null
 * arrival and always will. Reporting those as "direct", or averaging them into
 * a rate, would make every channel look worse than it is and would make the
 * first week's numbers look like a verdict. They are counted separately and
 * the panel says when real attribution starts.
 */

export type SubscriberRow = {
  arrivalSource: string | null;
  arrivalCampaign: string | null;
  confirmedAt: string | Date | null;
  unsubscribedAt: string | Date | null;
  createdAt: string | Date;
};

export type SourceRow = {
  /** Channel slug, "instagram" / "google" / "direct". */
  source: string;
  /** Everyone who arrived through it, confirmed or not. */
  total: number;
  /** Confirmed and still subscribed — the only figure that means anything
   *  commercially, since an unconfirmed row is an address that never opted in. */
  confirmed: number;
};

export type SourceSummary = {
  rows: SourceRow[];
  /** Subscribers from before attribution existed. Never guessed at. */
  unattributed: number;
  /** When the first attributed subscriber landed — the point from which these
   *  figures mean anything. Null until one exists. */
  since: Date | null;
};

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isActive(s: SubscriberRow): boolean {
  return Boolean(s.confirmedAt) && !s.unsubscribedAt;
}

/**
 * Group subscribers by arrival channel, busiest first.
 *
 * Ties break alphabetically so the table does not reshuffle between renders
 * when two channels are level.
 */
export function summariseSources(subs: SubscriberRow[]): SourceSummary {
  const attributed = subs.filter((s) => s.arrivalSource);
  const byChannel = new Map<string, SourceRow>();

  for (const s of attributed) {
    const key = s.arrivalSource!;
    const row = byChannel.get(key) ?? { source: key, total: 0, confirmed: 0 };
    row.total += 1;
    if (isActive(s)) row.confirmed += 1;
    byChannel.set(key, row);
  }

  const since = attributed.length
    ? attributed
        .map((s) => toDate(s.createdAt))
        .reduce((earliest, d) => (d < earliest ? d : earliest))
    : null;

  return {
    rows: [...byChannel.values()].sort(
      (a, b) => b.total - a.total || a.source.localeCompare(b.source)
    ),
    unattributed: subs.length - attributed.length,
    since,
  };
}

/**
 * The line the panel leads with.
 *
 * Deliberately refuses to draw a conclusion from an empty or near-empty table.
 * Attribution starts the day it ships, so for the first stretch "Instagram has
 * produced nothing" and "we have not been counting long enough to know" look
 * identical in the data and are completely different findings.
 */
export function readSources(summary: SourceSummary, now: Date = new Date()): string {
  if (summary.rows.length === 0) {
    return summary.unattributed > 0
      ? `No subscriber has been attributed yet. The ${summary.unattributed} on the list predate attribution, so this fills in from the next signup on.`
      : "No subscribers yet.";
  }

  const days = summary.since
    ? Math.max(1, Math.round((now.getTime() - summary.since.getTime()) / 86_400_000))
    : 1;
  const total = summary.rows.reduce((n, r) => n + r.total, 0);
  const top = summary.rows[0]!;

  // Under a fortnight, the honest reading is "too early", whatever the split
  // happens to look like. A channel can easily produce nothing for ten days
  // and then three in an afternoon.
  if (days < 14) {
    return `${total} attributed ${total === 1 ? "subscriber" : "subscribers"} over ${days} ${days === 1 ? "day" : "days"}. Too early to read anything into the split.`;
  }

  const share = Math.round((top.total / total) * 100);
  // Channel names are stored slugs and stay lower-case, so the sentence is
  // built to never start a clause with one.
  return `${total} attributed subscribers over ${days} days, led by ${top.source} with ${top.total} (${share}%).`;
}
