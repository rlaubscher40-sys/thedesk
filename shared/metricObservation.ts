import { metricHealth } from "./metricHealth";

export type MetricObservationInput = {
  metricKey: string;
  label: string;
  asOf: Date;
  updatedAt: Date;
  source: string | null;
};

export const METRIC_OBSERVATION_EXPLANATIONS: Record<string, string> = {
  "within review window": "Within the expected reporting window; check the observation date.",
  "old reporting period": "Older reporting period. This is not a current observation.",
  "collection overdue": "Refresh overdue. A newer observation may be available.",
  "invalid dates": "Date needs review. Do not treat this figure as current.",
  "check extracted evidence": "Extracted from reporting. Verify against the original source.",
  "cadence unconfigured": "Publication timing unverified. Do not assume this figure is current.",
};

/** These are review thresholds, not proof that the publisher has no newer data. */
export function describeMetricObservation(metric: MetricObservationInput, now = new Date()) {
  const health = metricHealth([metric], now).find((item) => item.key === metric.metricKey)!;
  const valid = Number.isFinite(metric.asOf.getTime());
  const date = valid ? metric.asOf.toISOString().slice(0, 10) : null;
  const dateLabel = valid
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(metric.asOf)
    : "Unavailable";

  return {
    date,
    dateLabel,
    state: health.state,
    withinReviewWindow: health.state === "within review window",
    explanation: METRIC_OBSERVATION_EXPLANATIONS[health.state] ?? "Observation unavailable.",
  };
}

export function metricObservationAskHref(metric: MetricObservationInput, value: string) {
  const observation = describeMetricObservation(metric);
  const timing = observation.date
    ? `as of ${observation.date}`
    : "with an unverified observation date";
  const detailed = `What does ${metric.label} at ${value} ${timing} mean for property? ${observation.explanation}`;
  // Ask accepts 240 characters. Retain the date and complete warning rather
  // than letting the receiving page cut a sentence or numeric value in half.
  const question =
    detailed.length <= 240
      ? detailed
      : `What does ${metric.label.slice(0, 70)} ${timing} mean for property? ${observation.explanation}`;
  return `/ask?q=${encodeURIComponent(question)}`;
}
