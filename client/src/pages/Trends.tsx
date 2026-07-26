/**
 * Trends — the numbers, in broadsheet dress.
 *
 * Three layers under the title block:
 *
 *   1. "In motion" — biggest 7-day movers, market-stress signal, next
 *      dates to watch, as three hairline-divided columns.
 *   2. The metric index — every live daily_metrics row with its 30-day
 *      series, sectioned by groupKey.
 *   3. Editorial telemetry — category heat + signal cadence. Still
 *      edition-level: these describe editorial output, not market data.
 *
 * Data sources and queries are unchanged; the panels, radii, shadows and
 * gradient section rules are gone.
 */
import { BarChart } from "@/components/charts/BarChart";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { HeatTreemap } from "@/components/charts/HeatTreemap";
import { sentimentStroke } from "@/components/charts/BroadsheetCharts";
import { useCategoryColour } from "@/lib/category";
import { Skeleton } from "@/components/ui/Skeleton";
import { MetricGroupGrid } from "@/components/trends/MetricGroupGrid";
import { ThisWeekInMotion } from "@/components/trends/ThisWeekInMotion";
import { PageTitle, SectionHead } from "@/components/broadsheet/PageTitle";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function TrendsPage() {
  // Live daily_metrics + 30-day history (same source Today's strip uses).
  const metricsQuery = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const historiesQuery = trpc.metrics.histories.useQuery(undefined, {
    staleTime: 30 * 60_000,
  });
  // Recent editions (newest-first) so the lede can pull marketStress +
  // datesToWatch from the most recent one.
  const editionsQuery = trpc.editions.list.useQuery();

  // Editorial telemetry, still from the edition-level aggregates.
  const heatQuery = trpc.trends.categoryHeat.useQuery({ days: 30 });
  const signalQuery = trpc.trends.signalFrequency.useQuery({ editionLimit: 8 });

  const heroLoading =
    metricsQuery.isLoading || historiesQuery.isLoading || editionsQuery.isLoading;
  const gridLoading = metricsQuery.isLoading || historiesQuery.isLoading;
  const metricCount = metricsQuery.data?.length ?? 0;

  return (
    <div>
      <PageTitle
        kicker="The Desk · Trends"
        title="The numbers"
        standfirst="What's moving, what isn't, and where the conversations are concentrating."
        stats={[
          ...(metricCount > 0
            ? [{ label: "Live metrics", value: String(metricCount) }]
            : []),
          { label: "History", value: "30 days" },
        ]}
      />

      <SectionErrorBoundary section="In motion">
        <ThisWeekInMotion
          metrics={metricsQuery.data}
          histories={historiesQuery.data}
          editions={editionsQuery.data}
          loading={heroLoading}
        />
      </SectionErrorBoundary>

      <SectionHead label="Live metrics · 30-day history" note="Refreshed every 5 min" />
      <div className={GUTTER_X}>
        <SectionErrorBoundary section="Metric index">
          <MetricGroupGrid
            metrics={metricsQuery.data}
            histories={historiesQuery.data}
            loading={gridLoading}
          />
        </SectionErrorBoundary>
      </div>

      <SectionHead label="Editorial telemetry" />
      <div
        className={cn(
          GUTTER_X,
          "grid gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] mt-6"
        )}
      >
        <SectionErrorBoundary section="Category heat">
          <div className="lg:pr-9 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
                Category heat
              </p>
              <p className="bs-label">Last 30 days</p>
            </div>
            <div className="mt-4">
              <CategoryHeat data={heatQuery.data} loading={heatQuery.isLoading} />
            </div>
          </div>
        </SectionErrorBoundary>

        <SectionErrorBoundary section="Signal cadence">
          <div className="lg:rule-hair-l lg:pl-9 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
                Signal cadence
              </p>
              <p className="bs-label">
                Signals + topics, last {signalQuery.data?.length ?? 0} editions
              </p>
            </div>
            <div className="mt-4">
              <SignalCadence data={signalQuery.data} loading={signalQuery.isLoading} />
            </div>
          </div>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

function CategoryHeat({
  data,
  loading,
}: {
  data:
    | Array<{ category: string; total: number; daily: number; weekly: number }>
    | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-72 w-full rounded-none" />;
  if (!data || data.length === 0)
    return <p className="text-[var(--color-fg-muted)]">No data yet.</p>;
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
  const colourFor = useCategoryColour();
  if (loading) return <Skeleton className="h-64 w-full rounded-none" />;
  if (!data || data.length === 0)
    return <p className="text-[var(--color-fg-muted)]">No editions yet.</p>;

  // BarChart paints these into SVG `fill` attributes, where a CSS var()
  // is not substituted — so they have to be resolved colours, and both
  // sources here are already theme-aware.
  const signalsColour = sentimentStroke("neutral");
  const topicsColour = colourFor("TECH");

  return (
    <>
      <BarChart
        xLabels={data.map((d) => `#${d.editionNumber}`)}
        series={[
          {
            key: "signals",
            label: "Signals",
            values: data.map((d) => d.signalCount),
            colour: signalsColour,
          },
          {
            key: "topics",
            label: "Topics",
            values: data.map((d) => d.topicCount),
            colour: topicsColour,
          },
        ]}
        height={260}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {[
          { label: "Signals", colour: signalsColour },
          { label: "Topics", colour: topicsColour },
        ].map((s) => (
          <span
            key={s.label}
            className="bs-label flex items-center gap-2"
            style={{ color: s.colour }}
          >
            <span
              className="h-1.5 w-3"
              style={{ background: s.colour }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
