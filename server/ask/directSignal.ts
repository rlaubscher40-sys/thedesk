import type { DailyMetric } from "../db/schema";
import type { AskContextSource } from "../prompts/ask";
import {
  describeMetricObservation,
  METRIC_OBSERVATION_EXPLANATIONS,
} from "../../shared/metricObservation";
import { displayMetricValue } from "./metricRetrieval";

/** The generated approvals hand-off asks for the meaning of one stored
 * observation. Answer that bounded question without speculative synthesis.
 * Changed values/dates decline instead of substituting another observation.
 */
export function directApprovalsSignalAnswer(
  question: string,
  metrics: DailyMetric[],
  evidence: AskContextSource[]
) {
  const match =
    /^What does Building approvals at (.+) (?:as of (\d{4}-\d{2}-\d{2})|with an unverified observation date) mean for property\? (.+)$/.exec(
      question
    );
  if (!match || !Object.values(METRIC_OBSERVATION_EXPLANATIONS).includes(match[3]!)) return null;
  const metric = metrics.find((row) => row.metricKey === "building_approvals");
  const observation = metric ? describeMetricObservation(metric) : null;
  const value = metric ? displayMetricValue(metric.value, metric.unit) : null;
  const source = evidence.find(
    (row) =>
      row.kind === "metric" &&
      row.category !== "LOCAL DATA" &&
      row.title === `${metric?.label}: ${value}` &&
      row.date === observation?.date
  );
  if (
    !metric ||
    !source ||
    !observation?.date ||
    observation.state === "invalid dates" ||
    metric.label !== "Building approvals" ||
    match[1] !== value ||
    match[2] !== observation.date ||
    !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(metric.value) ||
    !["", "dwellings", "units"].includes(metric.unit?.trim().toLowerCase() ?? "") ||
    !Number.isSafeInteger(Number(metric.value.replaceAll(",", "")))
  ) {
    return {
      status: "insufficient" as const,
      reason:
        "The linked building approvals observation could not be matched to a valid stored value and date. Open Signals to inspect the available observation; a different reporting period cannot be substituted for this one.",
      relatedSourceRefs: source ? [source.ref] : [],
    };
  }
  const count = Number(metric.value.replaceAll(",", "")).toLocaleString("en-AU");
  return {
    status: "answered" as const,
    headline: `Building approvals: ${count} dwellings, observation dated ${observation.date}`,
    answer: `The stored national monthly building approvals observation is ${count} total dwellings, dated ${observation.date}, attributed to ${metric.source ?? "the recorded publisher"}. [Source ${source.ref}] ${observation.explanation} Being within a reporting window does not establish that this is the publisher's newest release or describe conditions today.`,
    whyItMatters:
      "Building approvals count dwellings approved. They do not count construction starts, completed homes, available stock or occupied dwellings. This observation describes the approvals stage of housing supply.",
    deskTake:
      "This single observation cannot establish a trend, a gap between approvals and completions, construction delays, or future prices and rents. A repeated stored value does not establish an unchanged reporting period or a collection failure. Those conclusions require separate dated evidence.",
    whatWouldChangeOurMind:
      "A corrected release for this observation would change the reported figure. A verified comparison period could support a trend assessment. Separate starts, completions and duration data would be needed to assess construction progress.",
    signals: [],
    sourceRefs: [source.ref],
    confidence: "medium" as const,
  };
}
