/**
 * Intelligence dashboard.
 *
 * Top row of KPI tiles pulled from the most recent edition's keyMetrics
 * (week-on-week delta vs the prior edition), then a 12-column grid of
 * chart panels — metric history line chart spans 8 columns; category
 * heat treemap-style bars sit on the right; signal frequency runs
 * across the bottom.
 */
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function TrendsPage() {
  const heatQuery = trpc.trends.categoryHeat.useQuery({ days: 30 });
  const metricHistoryQuery = trpc.trends.metricHistory.useQuery({ limit: 12 });
  const signalQuery = trpc.trends.signalFrequency.useQuery({ editionLimit: 8 });

  return (
    <div>
      <PageHeader
        overline="The Desk · Trends"
        title="The numbers"
        kicker="What's moving, what isn't, and where the conversations are concentrating."
      />

      <SectionErrorBoundary section="KPI strip">
        <KpiStrip history={metricHistoryQuery.data} loading={metricHistoryQuery.isLoading} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-8">
        {/* Metric history line chart — primary panel, spans 8 cols on desktop. */}
        <SectionErrorBoundary section="Metric history">
          <Panel className="lg:col-span-8" overline="Metric history" subtitle={`Last ${metricHistoryQuery.data?.length ?? 0} editions`}>
            <MetricHistory
              data={metricHistoryQuery.data}
              loading={metricHistoryQuery.isLoading}
            />
          </Panel>
        </SectionErrorBoundary>

        {/* Category heat panel — right rail. */}
        <SectionErrorBoundary section="Category heat">
          <Panel className="lg:col-span-4" overline="Category heat" subtitle="Last 30 days">
            <CategoryHeat
              data={heatQuery.data}
              loading={heatQuery.isLoading}
            />
          </Panel>
        </SectionErrorBoundary>

        {/* Signal frequency — full-width bottom. */}
        <SectionErrorBoundary section="Signal frequency">
          <Panel
            className="lg:col-span-12"
            overline="Signal cadence"
            subtitle={`Signals + topics across last ${signalQuery.data?.length ?? 0} editions`}
          >
            <SignalCadence
              data={signalQuery.data}
              loading={signalQuery.isLoading}
            />
          </Panel>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

// ─── Panel chrome ───────────────────────────────────────────────────────────

function Panel({
  className,
  overline,
  subtitle,
  children,
}: {
  className?: string;
  overline: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel rounded p-5 sm:p-6", className)}>
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          {overline}
        </p>
        {subtitle && <p className="overline text-[var(--color-fg-subtle)]">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

// ─── KPI tiles ──────────────────────────────────────────────────────────────

type HistoryRow = {
  editionNumber: number;
  weekRange: string;
  keyMetrics: Record<string, string | number> | null;
};

function KpiStrip({
  history,
  loading,
}: {
  history: HistoryRow[] | undefined;
  loading: boolean;
}) {
  // history is ordered oldest-first, so the latest edition is the last row.
  const latest = history?.[history.length - 1];
  const prior = history?.[history.length - 2];
  const labels = useMemo(() => {
    if (!latest?.keyMetrics) return [];
    return Object.keys(latest.keyMetrics).slice(0, 4);
  }, [latest]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px panel rounded overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[var(--color-bg-elevated)] p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }
  if (!latest || labels.length === 0) {
    return (
      <p className="text-sm text-[var(--color-fg-muted)]">
        Metric history will populate once editions ship.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px panel rounded overflow-hidden">
      {labels.map((label, idx) => (
        <KpiTile
          key={`${label}-${idx}`}
          label={label}
          value={latest.keyMetrics![label]!}
          prev={prior?.keyMetrics?.[label] ?? null}
        />
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  prev,
}: {
  label: string;
  value: string | number;
  prev: string | number | null | undefined;
}) {
  const currentNum = toNumber(value);
  const prevNum = prev != null ? toNumber(prev) : NaN;
  const hasDelta = Number.isFinite(currentNum) && Number.isFinite(prevNum);
  const delta = hasDelta ? currentNum - prevNum : 0;
  const direction: "up" | "down" | "flat" = !hasDelta
    ? "flat"
    : Math.abs(delta) < 0.0001
      ? "flat"
      : delta > 0
        ? "up"
        : "down";

  const tone =
    direction === "up"
      ? "text-emerald-300"
      : direction === "down"
        ? "text-rose-300"
        : "text-[var(--color-fg-subtle)]";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  return (
    <div className="bg-[var(--color-bg-elevated)] p-5 hover:bg-[oklch(0.18_0.02_260)] transition-colors group">
      <p className="overline mb-3 truncate" style={{ letterSpacing: "0.16em" }}>
        {label}
      </p>
      <p className="font-serif text-3xl font-bold tabular-nums text-[var(--color-fg)] leading-none mb-2">
        {value}
      </p>
      <p className={cn("font-mono text-xs flex items-center gap-1.5", tone)}>
        <Icon className="h-3 w-3" />
        {hasDelta ? (
          <>
            <span className="tabular-nums">
              {delta > 0 ? "+" : ""}
              {delta.toFixed(Math.abs(delta) < 0.1 ? 3 : 2)}
            </span>
            <span className="text-[var(--color-fg-subtle)]">vs. prior</span>
          </>
        ) : (
          <span className="text-[var(--color-fg-subtle)]">no comparable</span>
        )}
      </p>
    </div>
  );
}

// ─── Metric history line chart ──────────────────────────────────────────────

function MetricHistory({
  data,
  loading,
}: {
  data: HistoryRow[] | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (!data || data.length === 0)
    return <p className="text-sm text-[var(--color-fg-muted)]">No editions with metrics yet.</p>;

  const keys = pickNumericMetricKeys(data);
  if (keys.length === 0)
    return (
      <p className="text-sm text-[var(--color-fg-muted)]">
        Stored metrics aren't numeric, so no chart to draw.
      </p>
    );

  const series = data.map((row) => {
    const next: Record<string, string | number> = { editionNumber: row.editionNumber };
    for (const k of keys) next[k] = toNumber(row.keyMetrics?.[k]);
    return next;
  });

  return (
    <>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={series} margin={{ top: 10, right: 16, bottom: 8, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis
            dataKey="editionNumber"
            tickFormatter={(v) => `#${v}`}
            tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "oklch(1 0 0 / 10%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.13 0.018 260)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "JetBrains Mono",
              padding: "10px 12px",
            }}
            cursor={{ stroke: "oklch(0.75 0.18 70 / 30%)", strokeWidth: 1 }}
          />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 4, stroke: "oklch(0.11 0.018 260)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {keys.map((k, i) => (
          <span
            key={k}
            className="overline flex items-center gap-2"
            style={{ color: CHART_PALETTE[i % CHART_PALETTE.length] }}
          >
            <span
              className="h-1.5 w-3 rounded-full"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            {k}
          </span>
        ))}
      </div>
    </>
  );
}

const CHART_PALETTE = [
  "oklch(0.78 0.18 70)",
  "oklch(0.65 0.18 255)",
  "oklch(0.72 0.17 155)",
  "oklch(0.65 0.18 295)",
  "oklch(0.7 0.18 210)",
];

function toNumber(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const match = v.match(/-?[\d,.]+/);
  if (!match) return NaN;
  return Number(match[0].replace(/,/g, ""));
}

function pickNumericMetricKeys(rows: HistoryRow[]): string[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.keyMetrics) continue;
    for (const [k, v] of Object.entries(row.keyMetrics)) {
      if (!Number.isFinite(toNumber(v))) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= Math.max(2, rows.length / 2))
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k)
    .slice(0, 5);
}

// ─── Category heat ──────────────────────────────────────────────────────────

function CategoryHeat({
  data,
  loading,
}: {
  data:
    | Array<{ category: string; total: number; daily: number; weekly: number }>
    | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.length === 0)
    return <p className="text-sm text-[var(--color-fg-muted)]">No data yet.</p>;

  const top = data.slice(0, 6);
  const maxTotal = Math.max(...top.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {top.map((row) => {
        const widthPct = (row.total / maxTotal) * 100;
        return (
          <div key={row.category} className="group">
            <div className="flex items-baseline justify-between mb-1.5">
              <span
                className="overline transition-colors"
                style={{ color: categoryColour(row.category) }}
              >
                {row.category}
              </span>
              <span className="font-mono text-xs tabular-nums text-[var(--color-fg-muted)]">
                {row.total}
                <span className="text-[var(--color-fg-subtle)] ml-1.5">
                  {row.daily}d · {row.weekly}w
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  background: categoryColour(row.category),
                  boxShadow: `0 0 16px 0 ${categoryColour(row.category)}40`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Signal cadence ─────────────────────────────────────────────────────────

function SignalCadence({
  data,
  loading,
}: {
  data:
    | Array<{
        editionNumber: number;
        weekOf: string;
        signalCount: number;
        topicCount: number;
      }>
    | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.length === 0)
    return <p className="text-sm text-[var(--color-fg-muted)]">No editions yet.</p>;

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: -10 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis
            dataKey="editionNumber"
            tickFormatter={(v) => `#${v}`}
            tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "oklch(1 0 0 / 10%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.13 0.018 260)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "JetBrains Mono",
              padding: "10px 12px",
            }}
            cursor={{ fill: "oklch(0.75 0.18 70 / 5%)" }}
          />
          <Bar dataKey="signalCount" name="Signals" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={`signals-${d.editionNumber}-${i}`} fill="oklch(0.78 0.18 70)" />
            ))}
          </Bar>
          <Bar dataKey="topicCount" name="Topics" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={`topics-${d.editionNumber}-${i}`} fill="oklch(0.65 0.18 255)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        <span className="overline flex items-center gap-2" style={{ color: "oklch(0.78 0.18 70)" }}>
          <span className="h-1.5 w-3 rounded-full" style={{ background: "oklch(0.78 0.18 70)" }} />
          Signals
        </span>
        <span
          className="overline flex items-center gap-2"
          style={{ color: "oklch(0.65 0.18 255)" }}
        >
          <span className="h-1.5 w-3 rounded-full" style={{ background: "oklch(0.65 0.18 255)" }} />
          Topics
        </span>
      </div>
    </>
  );
}

// Tiny unused for now but kept around so the import set doesn't grow stale.
export const _arrowRight = ArrowRight;
