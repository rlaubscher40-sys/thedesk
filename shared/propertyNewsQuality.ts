/** Conservative automatic-news holds, not a publisher rating or fact checker. */
export type NewsHold = "unattributed-search" | "promotional-headline" | "recycled-market-update";
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function propertyNewsHold(
  input: {
    title: string;
    source?: string | null;
  },
  asOf: string
): NewsHold | null {
  const title = input.title.slice(0, 1024);
  if (/^(google news|unknown|unknown publisher)$/i.test(input.source?.trim() ?? ""))
    return "unattributed-search";
  if (
    /\b(guaranteed (?:rental )?(?:returns?|profits?)|risk[- ]free (?:property )?investment|casino bonus|promo code)\b/i.test(
      title
    ) ||
    (/\b(market update|market report|emergency alert today)\b/i.test(title) &&
      /\([a-z0-9_-]{10,16}\)\s*$/i.test(title))
  )
    return "promotional-headline";
  // Only date-labelled market updates: a new ABS release about an older
  // observation or a historical comparison is not automatically stale news.
  if (
    /\b(?:property|housing|rental?|real estate) market (?:update|report)\b/i.test(title) &&
    /^\d{4}-(?:0[1-9]|1[0-2])-\d{2}$/.test(asOf)
  ) {
    const period =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i.exec(
        title
      );
    if (period) {
      const months =
        Number(asOf.slice(0, 4)) * 12 +
        Number(asOf.slice(5, 7)) -
        1 -
        (Number(period[2]) * 12 + MONTHS.indexOf(period[1]!.toLowerCase()));
      if (months >= 3) return "recycled-market-update";
    }
  }
  return null;
}

/** Feed-supplied timestamp, not ingestion time or an independently verified publication date. */
export function recentNewsTimestamp(value: string | null | undefined, now = new Date()): boolean {
  // Refuse ambiguous date-only/local strings; RSS parsers emit ISO or RFC dates.
  if (!value || !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(value)) return false;
  const calendar = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  if (calendar) {
    const day = new Date(`${calendar[1]}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== calendar[1])
      return false;
  }
  const time = Date.parse(value);
  return (
    Number.isFinite(now.getTime()) &&
    Number.isFinite(time) &&
    time <= now.getTime() &&
    now.getTime() - time <= 96 * 3_600_000
  );
}
