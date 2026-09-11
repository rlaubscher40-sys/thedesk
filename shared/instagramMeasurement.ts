/** A consistent first-day observation window, not a significance threshold. */
export const INSIGHT_MIN_AGE_HOURS = 24;
export const INSIGHT_MAX_AGE_HOURS = 48;
export const INSIGHT_RETRY_DAYS = 7;
export const INSIGHT_BATCH_LIMIT = 20;
export const INSIGHT_FIELDS = [
  "likes",
  "comments",
  "reach",
  "saved",
  "shares",
  "totalInteractions",
] as const;
export type MetricCounts = Partial<Record<(typeof INSIGHT_FIELDS)[number], number | null>>;

/** One coherent, earliest usable first-day reading, independent of later retries. */
export type FirstDayInsight = MetricCounts & { capturedAtMs: number };

export function firstDayReading<T extends MeasuredPost & { firstDayMetrics?: unknown }>(row: T): T {
  const saved = row.firstDayMetrics;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return row;
  const snapshot = saved as Record<string, unknown>;
  if (!Number.isSafeInteger(snapshot.capturedAtMs) || !validMetricCount(snapshot.reach)) return row;
  const reading = {
    ...row,
    ...Object.fromEntries(
      INSIGHT_FIELDS.map((key) => [key, validMetricCount(snapshot[key]) ? snapshot[key] : null])
    ),
    metricsFetchedAt: new Date(snapshot.capturedAtMs as number),
  };
  return inInsightWindow(reading) ? reading : row;
}

/** Operator-facing wording must preserve Meta's ambiguity and old snapshots. */
export function insightAttemptLabel(
  status: string | null | undefined,
  reason: string | null | undefined
): string {
  if (reason === "media_unavailable") return "Media unavailable or permission missing";
  if (reason === "access_denied") return "Account access needs attention";
  if (reason === "rate_limited") return "Rate limited; retry later";
  if (status === "complete") return "Complete";
  if (status === "partial") return "Partial; some counts unavailable";
  if (status === "unavailable") return "Metrics unavailable";
  if (status === "failed") return "Read failed; retry later";
  return "No attempt recorded";
}
export type MeasuredPost = MetricCounts & {
  createdAt?: Date | string | null;
  metricsFetchedAt: Date | string | null;
  metricsAttemptedAt?: Date | string | null;
};
export function validMetricCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export function measurementAgeHours(row: MeasuredPost): number | null {
  if (!row.createdAt || !row.metricsFetchedAt) return null;
  const age =
    (new Date(row.metricsFetchedAt).getTime() - new Date(row.createdAt).getTime()) / 3_600_000;
  return Number.isFinite(age) && age >= 0 ? age : null;
}
export function inInsightWindow(row: MeasuredPost): boolean {
  const age = measurementAgeHours(row);
  return age !== null && age >= INSIGHT_MIN_AGE_HOURS && age < INSIGHT_MAX_AGE_HOURS;
}
/** Save/share comparisons require both numerators; missing never means zero. */
export function completeInsightCounts(row: MetricCounts): boolean {
  return [row.reach, row.saved, row.shares, row.likes, row.comments].every(validMetricCount);
}
export function needsInsightRefresh(row: MeasuredPost, now = new Date()): boolean {
  if (!row.createdAt) return false;
  // Failed/partial reads can recover, but scheduler retries must not hammer
  // an inaccessible media ID or repeatedly replace an incomplete snapshot.
  if (row.metricsAttemptedAt) {
    const sinceAttempt = now.getTime() - new Date(row.metricsAttemptedAt).getTime();
    if (Number.isFinite(sinceAttempt) && sinceAttempt < 12 * 3_600_000) return false;
  }
  const age = (now.getTime() - new Date(row.createdAt).getTime()) / 3_600_000;
  if (!Number.isFinite(age) || age < INSIGHT_MIN_AGE_HOURS || age > INSIGHT_RETRY_DAYS * 24)
    return false;
  const measuredAge = measurementAgeHours(row);
  // Complete first-day snapshots stay fixed. Late recovery is useful in the
  // raw post list but will be explicitly excluded from format comparisons.
  return measuredAge === null || measuredAge < INSIGHT_MIN_AGE_HOURS || !completeInsightCounts(row);
}
