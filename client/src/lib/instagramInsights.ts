/** Descriptive first-day observations, never an automatic winner or causal verdict. */
import {
  INSTAGRAM_POST_TYPES,
  INSTAGRAM_POST_TYPE_LABELS,
  type InstagramPostType,
} from "@shared/const";
import { firstDayReading, inInsightWindow, validMetricCount } from "@shared/instagramMeasurement";
export type InsightRow = {
  postType: string;
  likes: number | null;
  comments: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  createdAt?: string | Date | null;
  metricsFetchedAt: string | Date | null;
  firstDayMetrics?: unknown;
};
export type FormatSummary = {
  postType: InstagramPostType;
  label: string;
  measured: number;
  awaiting: number;
  excluded: number;
  medianReach: number | null;
  savesPer1k: number | null;
  sharesPer1k: number | null;
  engagementPer1k: number | null;
  savesSamples: number;
  sharesSamples: number;
  engagementSamples: number;
};
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function rates(rows: InsightRow[], metric: (row: InsightRow) => number | null) {
  const values = rows.flatMap((row) => {
    const n = metric(row);
    return validMetricCount(n) && validMetricCount(row.reach) && row.reach > 0
      ? [(n / row.reach) * 1000]
      : [];
  });
  return { value: median(values), count: values.length };
}
export function summariseFormats(rows: InsightRow[]): FormatSummary[] {
  return INSTAGRAM_POST_TYPES.map((postType) => {
    const mine = rows.filter((row) => row.postType === postType).map(firstDayReading);
    const measured = mine.filter((row) => inInsightWindow(row) && validMetricCount(row.reach));
    const awaiting = mine.filter((row) => !row.metricsFetchedAt).length;
    const saves = rates(measured, (row) => row.saved);
    const shares = rates(measured, (row) => row.shares);
    const engagement = rates(measured, (row) =>
      validMetricCount(row.likes) && validMetricCount(row.comments)
        ? row.likes + row.comments
        : null
    );
    return {
      postType,
      label: INSTAGRAM_POST_TYPE_LABELS[postType],
      measured: measured.length,
      awaiting,
      excluded: mine.length - measured.length - awaiting,
      medianReach: median(measured.map((row) => row.reach!)),
      savesPer1k: saves.value,
      sharesPer1k: shares.value,
      engagementPer1k: engagement.value,
      savesSamples: saves.count,
      sharesSamples: shares.count,
      engagementSamples: engagement.count,
    };
  });
}
export function readFormats(summaries: FormatSummary[]): string {
  const total = summaries.reduce((n, s) => n + s.measured, 0);
  if (!total)
    return "No comparable first-day snapshots yet. Only readings captured 24–48 hours after publication enter this comparison.";
  const formats = summaries.filter((s) => s.measured > 0).length;
  return `${total} first-day snapshot${total === 1 ? "" : "s"} across ${formats} format${formats === 1 ? "" : "s"}. These are exploratory observations, not proof of a winning format. Test one change at a time and compare the next batch.`;
}
