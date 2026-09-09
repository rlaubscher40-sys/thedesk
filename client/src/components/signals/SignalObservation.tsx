import type { describeMetricObservation } from "@shared/metricObservation";

export function SignalObservation({
  observation,
}: {
  observation: ReturnType<typeof describeMetricObservation>;
}) {
  return (
    <div className="mt-2 text-sm leading-5 text-[var(--color-fg-muted)]">
      <p>
        {observation.date ? (
          <>
            Observation as of <time dateTime={observation.date}>{observation.dateLabel}</time>
          </>
        ) : (
          "Observation date unavailable"
        )}
      </p>
      {!observation.withinReviewWindow && <p className="mt-1">{observation.explanation}</p>}
    </div>
  );
}
