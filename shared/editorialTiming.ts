const months =
  "january february march april may june july august september october november december".split(
    " "
  );
export function editorialToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function editorialTimeContext(now = new Date()): string {
  return `Current Sydney calendar date: ${editorialToday(now)}. Keep original publication dates, observation periods and forecast horizons distinct. Use absolute dates for event timing, not today, yesterday, next week or rounded countdowns such as two years away. For multi-stage frameworks, state the separate dates for consultation, data collection and publication; never substitute one milestone for another. A follow-up report is not a newly announced event. Never describe a past deadline as something still to watch. Historical comparisons and older reporting periods are valid when explicitly labelled. Industry-commissioned modelling is a forecast with an attributed source, not an observed outcome. Do not invent dates, figures or causation. If a timely, grounded angle is unavailable, return null (or SKIP for a single-field response).`;
}
/** Explicit expired deadlines in forward-looking clauses only. Historical
 * observations, fiscal years and completed comparisons remain valid. */
export function staleFutureDeadline(text: string | null | undefined, now = new Date()): boolean {
  if (!text) return false;
  const today = editorialToday(now);
  for (const sentence of text.split(/[\n.!?]/)) {
    if (!/\b(?:watch(?:ing)?|will|would|next|if|expected to|set to)\b/i.test(sentence)) continue;
    if (
      /\b(?:had|was|were) (?:expected|forecast|predicted)|\bpreviously expected\b/i.test(sentence)
    )
      continue;
    for (const m of sentence.matchAll(
      /\bby\s+(?:(early|mid|late|end(?: of)?)[- ]+)?(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(20\d{2})\b/gi
    )) {
      const month = m[2]
        ? months.indexOf(m[2].toLowerCase()) + 1
        : m[1]?.toLowerCase() === "early"
          ? 4
          : m[1]?.toLowerCase() === "mid"
            ? 8
            : 12;
      const end = new Date(Date.UTC(Number(m[3]), month, 0)).toISOString().slice(0, 10);
      if (end < today) return true;
    }
  }
  return false;
}
export function validEditorialAngle(value: string | null, now = new Date()): string | null {
  return value &&
    !staleFutureDeadline(value, now) &&
    !unstableEditorialTiming(value) &&
    !/^(?:null|SKIP)\.?$/i.test(value.trim()) &&
    !/^(?:Buying|Holding|Watching):\s*(?:null|SKIP)\s*$/im.test(value)
    ? value
    : null;
}

/** Reusable cards need explicit dates. Relative event labels and rounded
 * countdowns silently become wrong when a story rolls into tomorrow's feed. */
export function unstableEditorialTiming(value: string): boolean {
  return /\b(?:today|yesterday|tomorrow|next (?:week|month|year))\b|\b(?:one|two|three|\d+) years? (?:away|before|until|from now)\b/i.test(
    value
  );
}
