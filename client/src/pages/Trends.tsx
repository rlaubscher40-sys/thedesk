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
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { PageHeader } from "@/components/PageHeader";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Sparkline } from "@/components/charts/Sparkline";
import { HeatTreemap } from "@/components/charts/HeatTreemap";
import { Skeleton } from "@/components/ui/Skeleton";
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

  // Build the historical series of numeric values for each KPI label.
  // Used by the inline sparkline next to the current number.
  const seriesByLabel = new Map<string, number[]>();
  for (const label of labels) {
    const series: number[] = [];
    for (const row of history ?? []) {
      const v = row.keyMetrics?.[label];
      if (v == null) continue;
      const n = toNumber(v);
      if (Number.isFinite(n)) series.push(n);
    }
    seriesByLabel.set(label, series);
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px panel rounded overflow-hidden">
      {labels.map((label, idx) => (
        <KpiTile
          key={`${label}-${idx}`}
          label={label}
          value={latest.keyMetrics![label]!}
          prev={prior?.keyMetrics?.[label] ?? null}
          series={seriesByLabel.get(label) ?? []}
        />
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  prev,
  series,
}: {
  label: string;
  value: string | number;
  prev: string | number | null | undefined;
  series: number[];
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

  // Render the number through CountUp when we can parse it, otherwise fall
  // back to the raw string (e.g. "AUD/USD" might be "0.659").
  const numeric = Number.isFinite(currentNum);
  // Match the precision of the stored value — 2 dp for percentages and
  // exchange rates, 0 dp for index points.
  const decimals = numeric ? inferDecimals(value) : 0;
  // Preserve trailing % if the source string had one.
  const suffix =
    typeof value === "string" && value.includes("%") ? "%" : "";

  const tone =
    direction === "up"
      ? "text-emerald-300"
      : direction === "down"
        ? "text-rose-300"
        : "text-[var(--color-fg-subtle)]";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  const sparkColour =
    direction === "up"
      ? "oklch(0.72 0.17 155)"
      : direction === "down"
        ? "oklch(0.68 0.20 15)"
        : "oklch(0.78 0.18 70)";

  return (
    <div className="bg-[var(--color-bg-elevated)] p-5 hover:bg-[oklch(0.18_0.02_260)] transition-colors relative">
      <p className="overline mb-3 truncate" style={{ letterSpacing: "0.16em" }}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-3 mb-2">
        <p className="font-serif text-3xl font-bold text-[var(--color-fg)] leading-none">
          {numeric ? (
            <CountUp
              value={currentNum}
              decimals={decimals}
              suffix={suffix}
              group={currentNum >= 1000}
            />
          ) : (
            <span className="tabular-nums">{value}</span>
          )}
        </p>
        {/* Inline sparkline — shows the trajectory beside the headline number. */}
        {series.length >= 2 && (
          <Sparkline values={series} width={92} height={32} colour={sparkColour} />
        )}
      </div>
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

function inferDecimals(v: string | number): number {
  if (typeof v === "number") return Number.isInteger(v) ? 0 : 2;
  const m = String(v).match(/\.(\d+)/);
  if (!m) return 0;
  return Math.min(3, m[1]!.length);
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

  const xLabels = data.map((r) => `#${r.editionNumber}`);
  const series = keys.map((k, i) => ({
    key: k,
    label: k,
    values: data.map((row) => toNumber(row.keyMetrics?.[k])),
    colour: CHART_PALETTE[i % CHART_PALETTE.length]!,
  }));

  return (
    <>
      <LineChart xLabels={xLabels} series={series} height={320} />
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
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (!data || data.length === 0)
    return <p className="text-sm text-[var(--color-fg-muted)]">No data yet.</p>;
  return <HeatTreemap data={data.slice(0, 9)} height={320} />;
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

  const xLabels = data.map((d) => `#${d.editionNumber}`);
  return (
    <>
      <BarChart
        xLabels={xLabels}
        series={[
          {
            key: "signals",
            label: "Signals",
            values: data.map((d) => d.signalCount),
            colour: "oklch(0.78 0.18 70)",
          },
          {
            key: "topics",
            label: "Topics",
            values: data.map((d) => d.topicCount),
            colour: "oklch(0.65 0.18 255)",
          },
        ]}
        height={260}
      />
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

