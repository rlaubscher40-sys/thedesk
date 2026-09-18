import { RELEASE_CALENDAR_TERMS, releaseCalendar, type ReleaseEvent } from "./releaseCalendar";

/** Only what this panel needs from a stored metric: the last result The Desk holds. */
export type CalendarMetric = {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  asOf?: Date | string | null;
};

function lastResult(
  metricKey: string | null,
  metrics: CalendarMetric[]
): { label: string; value: string; asOf: string | null } | null {
  if (!metricKey) return null;
  const metric = metrics.find((item) => item.metricKey === metricKey);
  if (!metric) return null;
  const asOf = metric.asOf ? new Date(metric.asOf) : null;
  return {
    label: metric.label,
    // "%" sits tight against the number; a worded unit takes a space.
    value: `${metric.value}${metric.unit ? (metric.unit === "%" ? metric.unit : ` ${metric.unit}`) : ""}`,
    asOf:
      asOf && Number.isFinite(asOf.getTime())
        ? asOf.toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })
        : null,
  };
}

export function ReleaseCalendarRead({
  now,
  metrics = [],
  events,
}: {
  now: Date;
  metrics?: CalendarMetric[];
  events?: ReleaseEvent[];
}) {
  const views = releaseCalendar(now, events);
  return (
    <section
      id="release-calendar"
      className="rule-major mt-10 pt-6 pb-6"
      aria-label="Official release calendar"
    >
      <p className="bs-label-accent">Coming from the official sources</p>
      <h2 className="font-serif text-3xl font-bold mt-3">What is due, and what it will measure.</h2>
      <p className="font-serif text-lg text-[var(--color-fg-muted)] mt-3 max-w-[72ch]">
        The releases that move housing coverage, with the period each one observes and the last
        result The Desk holds. Where a date is not shown, The Desk has not read one off the
        publisher's calendar and does not estimate it — the publisher's own schedule is linked
        against every entry.
      </p>

      <ul className="mt-6 grid gap-6">
        {views.map((view) => {
          const previous = lastResult(view.event.metricKey, metrics);
          return (
            <li key={view.event.id} className="rule-hair pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-serif text-xl font-bold">
                  {view.event.title}
                  <span className="block bs-label mt-1 font-sans">{view.event.publisher}</span>
                </h3>
                <p className="font-mono text-sm">
                  {view.whenLabel}
                  {view.daysAway !== null && !view.past ? ` · in ${view.daysAway} days` : ""}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed max-w-[85ch]">{view.event.measures}</p>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                {view.event.cadence} · observes {view.event.observationPeriod}
              </p>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{view.dateBasis}</p>
              {previous && (
                <p className="mt-2 text-sm">
                  Last result The Desk holds: <span className="font-mono">{previous.value}</span>
                  {previous.asOf
                    ? ` · observed ${previous.asOf}`
                    : " · observation date unrecorded"}
                  . The next release replaces it; it does not add to it.
                </p>
              )}
              <p className="mt-3 text-sm flex flex-wrap gap-4">
                <a
                  className="bs-link underline"
                  href={view.event.sourceUrl}
                  rel="noopener noreferrer"
                >
                  Latest release ↗
                </a>
                <a
                  className="bs-link underline"
                  href={view.event.sourceCalendarUrl}
                  rel="noopener noreferrer"
                >
                  Publisher's schedule ↗
                </a>
                <span className="text-[var(--color-fg-muted)]">
                  Checked {view.event.lastCheckedOn}
                  {view.needsRecheck ? " · due for re-checking" : ""}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-sm leading-relaxed text-[var(--color-fg-muted)] max-w-[85ch]">
        {RELEASE_CALENDAR_TERMS}
      </p>
    </section>
  );
}
