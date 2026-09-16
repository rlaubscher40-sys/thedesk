import { describeMetricObservation, type MetricObservationInput } from "./metricObservation";
import { METRIC_EXPECTATIONS } from "./metricHealth";
/** Preserve publisher precision, group magnitudes and keep units unambiguous. */
export function formatMetricValue(metric: { value: string; unit?: string | null }): string {
  const unit = metric.unit?.trim() ?? "";
  let raw = metric.value.trim();
  if (unit === "$" && raw.startsWith("$")) raw = raw.slice(1);
  if (unit === "%" && raw.endsWith("%")) raw = raw.slice(0, -1);
  const plain = raw.replaceAll(",", "");
  const formatted = /^-?\d+(\.\d+)?$/.test(plain)
    ? Number(plain).toLocaleString("en-AU", {
        minimumFractionDigits: plain.split(".")[1]?.length ?? 0,
        maximumFractionDigits: Math.min(20, plain.split(".")[1]?.length ?? 0),
      })
    : raw;
  if (!unit || (unit !== "$" && unit !== "%" && raw.endsWith(unit))) return formatted;
  return unit === "$" ? `$${formatted}` : unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}
/** Stored history is sampled at collection time, not a chain of dated releases. */
export function hasDailyObservations(key: string): boolean {
  return ["cash_rate", "asx200", "audusd", "audgbp", "audeur", "us10y"].includes(key);
}
/** An undated prior is not a previous publisher release. */
export function comparableMetricPrior(metric: {
  metricKey: string;
  previousValue?: string | null;
}): string | null {
  return hasDailyObservations(metric.metricKey) ? (metric.previousValue ?? null) : null;
}
export function metricTiming(metric: MetricObservationInput): string {
  const observation = describeMetricObservation(metric);
  const cadence =
    METRIC_EXPECTATIONS.find((item) => item.key === metric.metricKey)?.period ??
    "Release timing unverified";
  return `${cadence} · Observation ${observation.dateLabel}${observation.withinReviewWindow ? "" : ` · ${observation.explanation}`}`;
}
export function historyChange(
  metric: { metricKey: string; unit?: string | null },
  series: Array<{ value: number; recordedAt: Date }>
): string {
  if (!hasDailyObservations(metric.metricKey))
    return "Release-based figure; stored samples are not release-to-release changes";
  if (series.length < 2) return "Not enough history to compare";
  const first = series[0]!,
    last = series[series.length - 1]!;
  const delta = last.value - first.value;
  const date = (d: Date) =>
    new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  const period = `${date(first.recordedAt)} to ${date(last.recordedAt)}`;
  if (delta === 0) return `No change in stored observations · ${period}`;
  if (metric.unit === "%")
    return `${delta > 0 ? "+" : ""}${Number(delta.toFixed(3))} percentage points · ${period}`;
  if (!first.value) return `Comparison unavailable from a zero baseline · ${period}`;
  const change = (delta / Math.abs(first.value)) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}% · ${period}`;
}
