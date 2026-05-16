/**
 * Trends-page metric grid — every live `daily_metrics` row rendered as a
 * tile with a real 30-day sparkline (from `daily_metric_history`), sectioned
 * by groupKey so MACRO / PROPERTY / LABOUR / MARKETS / DEMOGRAPHICS each
 * land in their own panel.
 *
 * This is the deeper sibling of the Today-page MetricsStrip — same data,
 * larger tiles, longer sparklines, room to render the context blurb at
 * full width.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { DailyMetric } from "@shared/types";
import { Sparkline } from "@/components/charts/Sparkline";
import { Skeleton } from "@/components/ui/Skeleton";

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-sm" />
        ))}
      </div>
    );
  }
  if (!metrics || metrics.length === 0) {
    return (
      <div className="panel rounded p-6 text-sm text-[var(--color-fg-muted)]">
        Daily metrics haven't been ingested yet. Trigger the daily-metrics
        workflow and refresh.
      </div>
    );
  }

  const grouped = groupByKey(metrics);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {grouped.map((g) => (
        <GroupPanel key={g.key} group={g} histories={histories ?? {}} />
      ))}
    </div>
  );
}

function GroupPanel({
  group,
  histories,
}: {
  group: { key: string; label: string; metrics: DailyMetric[] };
  histories: Histories;
}) {
  return (
    <section className="panel rounded p-5 sm:p-6">
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <p className="overline-amber" style={{ letterSpacing: "0.22em" }}>
          {group.label}
        </p>
        <p className="overline text-[var(--color-fg-subtle)]">
          {group.metrics.length}
        </p>
      </header>
      <ul className="space-y-px bg-[var(--color-border)] rounded-sm overflow-hidden">
        {group.metrics.map((m) => (
          <MetricRow
            key={m.metricKey}
            metric={m}
            history={histories[m.metricKey] ?? []}
          />
        ))}
      </ul>
    </section>
  );
}

function MetricRow({
  metric,
  history,
}: {
  metric: DailyMetric;
  history: Array<{ value: number; recordedAt: Date }>;
}) {
  const values = history.map((p) => p.value);
  const trend = inferTrend(values);
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const colour =
    trend === "up"
      ? "oklch(0.72 0.17 155)"
      : trend === "down"
        ? "oklch(0.68 0.20 15)"
        : "oklch(0.55 0.02 260)";

  return (
    <li className="bg-[var(--color-bg-elevated)] p-4 grid grid-cols-[minmax(0,1fr)_140px] gap-4 items-center">
      <div className="min-w-0">
        <p
          className="overline mb-1.5 truncate text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.16em" }}
          title={metric.label}
        >
          {metric.label}
        </p>
        <div className="flex items-baseline gap-2.5">
          <p className="font-serif text-xl sm:text-2xl font-bold tabular-nums leading-none">
            {metric.value}
            {metric.unit ?? ""}
          </p>
          {values.length >= 2 && (
            <span
              className="inline-flex items-center font-mono"
              style={{ color: colour, fontSize: "10px" }}
              aria-label={`${trend} over 30 days`}
            >
              <Icon className="h-3 w-3" strokeWidth={2.5} />
            </span>
          )}
        </div>
        {metric.context && (
          <p
            className="font-mono text-[10px] text-[var(--color-fg-subtle)] leading-relaxed mt-1.5 line-clamp-2"
            title={metric.context}
          >
            {metric.context}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {values.length >= 2 ? (
          <Sparkline values={values} width={140} height={36} colour={colour} />
        ) : (
          <span
            className="text-[10px] font-mono text-[var(--color-fg-subtle)]"
            style={{ letterSpacing: "0.16em" }}
          >
            NO HISTORY
          </span>
        )}
        {metric.source && (
          <span
            className="overline text-[var(--color-fg-subtle)]"
            style={{ letterSpacing: "0.16em", fontSize: "9px" }}
          >
            {metric.source}
          </span>
        )}
      </div>
    </li>
  );
}

function inferTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const start = values[0]!;
  const end = values[values.length - 1]!;
  if (start === 0) return "flat";
  const pct = ((end - start) / Math.abs(start)) * 100;
  if (Math.abs(pct) < 0.05) return "flat";
  return pct > 0 ? "up" : "down";
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
