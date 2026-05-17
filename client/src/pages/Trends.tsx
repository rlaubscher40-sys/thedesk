/**
 * Intelligence dashboard. Three layers, top to bottom:
 *
 *   1. "This week in motion" hero — biggest 7-day movers, market-stress
 *      signal, next dates to watch. Editorial front-page.
 *   2. Grouped metric grid — every live daily_metrics row with a 30-day
 *      sparkline, sectioned by groupKey (Macro / Property / Labour /
 *      Markets / Demographics).
 *   3. Editorial telemetry — category heat + signal cadence across recent
 *      editions. These remain edition-level since they describe editorial
 *      output, not market data.
 */
import { PageHeader } from "@/components/PageHeader";
import { BarChart } from "@/components/charts/BarChart";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { HeatTreemap } from "@/components/charts/HeatTreemap";
import { Skeleton } from "@/components/ui/Skeleton";
import { MetricGroupGrid } from "@/components/trends/MetricGroupGrid";
import { ThisWeekInMotion } from "@/components/trends/ThisWeekInMotion";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function TrendsPage() {
  // Live daily_metrics + 30-day history (same source the Today strip uses).
  const metricsQuery = trpc.metrics.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const historiesQuery = trpc.metrics.histories.useQuery(undefined, {
    staleTime: 30 * 60_000,
  });
  // Recent editions (newest-first) so the hero can pull marketStress +
  // datesToWatch from the most recent one.
  const editionsQuery = trpc.editions.list.useQuery();

  // Editorial telemetry still pulled from the edition-level aggregates.
  const heatQuery = trpc.trends.categoryHeat.useQuery({ days: 30 });
  const signalQuery = trpc.trends.signalFrequency.useQuery({ editionLimit: 8 });

  const heroLoading =
    metricsQuery.isLoading || historiesQuery.isLoading || editionsQuery.isLoading;
  const gridLoading = metricsQuery.isLoading || historiesQuery.isLoading;

  return (
    <div>
      <PageHeader
        overline="The Desk · Trends"
        title="The numbers"
        kicker="What's moving, what isn't, and where the conversations are concentrating."
        actions={
          <TrendsMetaPanel
            metricCount={metricsQuery.data?.length ?? 0}
            historyDays={30}
          />
        }
      />

      <SectionErrorBoundary section="This week in motion">
        <ThisWeekInMotion
          metrics={metricsQuery.data}
          histories={historiesQuery.data}
          editions={editionsQuery.data}
          loading={heroLoading}
        />
      </SectionErrorBoundary>

      <div className="mb-4 flex items-center gap-3">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Live metrics · 30-day history
        </p>
        <span
          className="block flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
          }}
          aria-hidden="true"
        />
      </div>

      <SectionErrorBoundary section="Metric group grid">
        <MetricGroupGrid
          metrics={metricsQuery.data}
          histories={historiesQuery.data}
          loading={gridLoading}
        />
      </SectionErrorBoundary>

      <div className="mt-12 mb-4 flex items-center gap-3">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Editorial telemetry
        </p>
        <span
          className="block flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
          }}
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <SectionErrorBoundary section="Category heat">
          <Panel
            className="lg:col-span-5"
            overline="Category heat"
            subtitle="Last 30 days"
          >
            <CategoryHeat
              data={heatQuery.data}
              loading={heatQuery.isLoading}
            />
          </Panel>
        </SectionErrorBoundary>

        <SectionErrorBoundary section="Signal frequency">
          <Panel
            className="lg:col-span-7"
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
        {subtitle && (
          <p className="overline text-[var(--color-fg-subtle)]">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

// ─── Editorial telemetry panels (unchanged from the previous Trends) ─────────

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
        <span
          className="overline flex items-center gap-2"
          style={{ color: "oklch(0.78 0.18 70)" }}
        >
          <span
            className="h-1.5 w-3 rounded-full"
            style={{ background: "oklch(0.78 0.18 70)" }}
          />
          Signals
        </span>
        <span
          className="overline flex items-center gap-2"
          style={{ color: "oklch(0.65 0.18 255)" }}
        >
          <span
            className="h-1.5 w-3 rounded-full"
            style={{ background: "oklch(0.65 0.18 255)" }}
          />
          Topics
        </span>
      </div>
    </>
  );
}

/**
 * Editorial meta panel for the Trends header. Earns the right-side
 * whitespace with three telemetry stats: how many live daily_metrics
 * series are tracked, the rolling history window for the sparklines,
 * and the live-data refresh cadence. Same mono-overline pattern as
 * Editions and Archive so the masthead reads consistently.
 */
function TrendsMetaPanel({
  metricCount,
  historyDays,
}: {
  metricCount: number;
  historyDays: number;
}) {
  return (
    <div
      className="hidden md:block panel rounded-sm px-5 py-4 space-y-3.5 text-right shrink-0"
      style={{ minWidth: 200 }}
    >
      {metricCount > 0 && (
        <TrendsMetaRow
          label="Live metrics"
          value={String(metricCount).padStart(2, "0")}
        />
      )}
      <TrendsMetaRow label="History window" value={`${historyDays} days`} />
      <TrendsMetaRow label="Refresh" value="Every 5 min" />
    </div>
  );
}

function TrendsMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p
        className="font-mono uppercase text-[var(--color-fg-subtle)]"
        style={{ fontSize: "9px", letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-[var(--color-fg)] tabular-nums"
        style={{ fontSize: "12px", letterSpacing: "0.04em" }}
      >
        {value}
      </p>
    </div>
  );
}
