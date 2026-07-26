/**
 * Trends metric index — every live `daily_metrics` row with its 30-day
 * series, sectioned by groupKey (Macro / Property / Labour / Markets /
 * Demographics).
 *
 * The deeper sibling of Today's "Where things stand": same data, every
 * metric rather than the first four, and room for the context blurb at
 * full width. Restyled as hairline rows under mono section heads —
 * previously two columns of rounded panels, which is the card vocabulary
 * the redesign drops.
 */
import type { DailyMetric } from "@shared/types";
import { MetricSparkline } from "@/components/charts/BroadsheetCharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { resolveMetricTrend } from "@/lib/metrics";

type Histories = Record<string, Array<{ value: number; recordedAt: Date }>>;

const GROUP_ORDER = ["MACRO", "PROPERTY", "LABOUR", "MARKETS", "DEMOGRAPHICS"];
const GROUP_LABELS: Record<string, string> = {
  MACRO: "Macro & rates",
  PROPERTY: "Property",
  LABOUR: "Labour & wages",
  MARKETS: "Markets",
  DEMOGRAPHICS: "Demographics",
};

export function MetricGroupGrid({
  metrics,
  histories,
  loading,
}: {
  metrics: DailyMetric[] | undefined;
  histories: Histories | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-10 lg:grid-cols-2 mt-6" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="h-14 w-full rounded-none" />
            <Skeleton className="h-14 w-full rounded-none" />
          </div>
        ))}
      </div>
    );
  }
  if (!metrics || metrics.length === 0) {
    return (
      <p className="mt-6 text-[var(--color-fg-muted)]">
        Daily metrics haven&apos;t been ingested yet. Trigger the daily-metrics
        workflow and refresh.
      </p>
    );
  }

  const grouped = groupByKey(metrics);

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2 mt-6">
      {grouped.map((g) => (
        <section key={g.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
              {g.label}
            </p>
            <p className="bs-label tabular-nums">{g.metrics.length}</p>
          </div>
          <div className="mt-3">
            {g.metrics.map((m, i) => (
              <MetricRow
                key={m.metricKey}
                metric={m}
                history={histories?.[m.metricKey] ?? []}
                last={i === g.metrics.length - 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MetricRow({
  metric,
  history,
  last,
}: {
  metric: DailyMetric;
  history: Array<{ value: number; recordedAt: Date }>;
  last: boolean;
}) {
  const values = history.map((p) => p.value);
  const suffix = metric.unit ?? "";
  const { sentiment, trend, hasDelta } = resolveMetricTrend(
    metric.label,
    `${metric.value}${suffix}`,
    metric.previousValue != null ? `${metric.previousValue}${suffix}` : null
  );

  return (
    <div
      className={cn(
        "rule-hair grid grid-cols-[minmax(0,1fr)_150px] gap-5 items-center py-4",
        last && "rule-hair-b"
      )}
    >
      <div className="min-w-0">
        <p className="bs-label truncate" style={{ letterSpacing: "0.16em" }} title={metric.label}>
          {metric.label}
        </p>
        <div className="flex items-baseline gap-2.5 mt-1.5">
          <p
            className="font-serif font-bold tabular-nums"
            style={{ fontSize: 26, lineHeight: 1 }}
          >
            {metric.value}
            {suffix}
          </p>
          {hasDelta && trend !== "flat" && (
            <span
              className="font-mono"
              style={{ fontSize: 10, color: `var(--sentiment-${sentiment})` }}
              aria-label={`${trend} versus prior`}
            >
              {trend === "up" ? "▲" : "▼"}
            </span>
          )}
        </div>
        {metric.context && (
          <p
            className="font-mono mt-1.5 text-[var(--color-fg-subtle)]"
            style={{ fontSize: 10, lineHeight: 1.5 }}
            title={metric.context}
          >
            {metric.context}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {values.length >= 2 ? (
          <MetricSparkline
            values={values}
            sentiment={sentiment}
            height={36}
            label={`${metric.label}, 30-day trend`}
          />
        ) : (
          <span className="bs-label" style={{ letterSpacing: "0.16em" }}>
            No history
          </span>
        )}
        {metric.source && (
          <span className="bs-label" style={{ letterSpacing: "0.16em" }}>
            {metric.source}
          </span>
        )}
      </div>
    </div>
  );
}

function groupByKey(
  metrics: DailyMetric[]
): Array<{ key: string; label: string; metrics: DailyMetric[] }> {
  const byKey = new Map<string, DailyMetric[]>();
  for (const m of metrics) {
    const k = (m.groupKey ?? "OTHER").toUpperCase();
    const arr = byKey.get(k) ?? [];
    arr.push(m);
    byKey.set(k, arr);
  }
  // Stable order: known groups first, then anything else alphabetical.
  const result: Array<{ key: string; label: string; metrics: DailyMetric[] }> = [];
  for (const k of GROUP_ORDER) {
    const list = byKey.get(k);
    if (!list) continue;
    result.push({ key: k, label: GROUP_LABELS[k] ?? k, metrics: list });
  }
  const extras = Array.from(byKey.entries())
    .filter(([k]) => !GROUP_ORDER.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [k, list] of extras) {
    result.push({ key: k, label: GROUP_LABELS[k] ?? k, metrics: list });
  }
  return result;
}
