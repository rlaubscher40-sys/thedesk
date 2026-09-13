import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatMetricValue, metricTiming } from "@shared/metricPresentation";
import { GUTTER_X } from "../tokens";
export function MorningSignals() {
  const metrics = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const keys = ["cash_rate", "building_approvals", "unemployment"];
  const shown = keys.flatMap((key) => metrics.data?.find((m) => m.metricKey === key) ?? []);
  if (!shown.length) return null;
  return (
    <section className={`${GUTTER_X} mt-7`} aria-label="Economic context">
      <div className="flex justify-between gap-4 pb-3">
        <h2 className="bs-label-accent">Economic context</h2>
        <Link href="/signals" className="bs-link text-sm">
          Explore data →
        </Link>
      </div>
      <div className="rule-major rule-hair-b grid sm:grid-cols-3 gap-5">
        {shown.map((metric) => (
          <Link
            key={metric.metricKey}
            href={`/signals?metric=${metric.metricKey}`}
            className="py-4 block bs-row min-w-0"
          >
            <p className="bs-label">{metric.label}</p>
            <p className="font-serif text-3xl mt-2 tabular-nums">{formatMetricValue(metric)}</p>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{metricTiming(metric)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
