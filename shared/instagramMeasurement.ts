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
export type MeasuredPost = MetricCounts & {
  createdAt?: Date | string | null;
  metricsFetchedAt: Date | string | null;
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
  const age = (now.getTime() - new Date(row.createdAt).getTime()) / 3_600_000;
  if (!Number.isFinite(age) || age < INSIGHT_MIN_AGE_HOURS || age > INSIGHT_RETRY_DAYS * 24)
    return false;
  const measuredAge = measurementAgeHours(row);
  // Complete first-day snapshots stay fixed. Late recovery is useful in the
  // raw post list but will be explicitly excluded from format comparisons.
  return measuredAge === null || measuredAge < INSIGHT_MIN_AGE_HOURS || !completeInsightCounts(row);
}
