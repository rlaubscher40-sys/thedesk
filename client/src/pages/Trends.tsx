/**
 * Trends page. Three charts: metric history line, category heat bars, signal
 * frequency over recent editions. All client-side via Recharts.
 */
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
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryColour } from "@/lib/category";
import { trpc } from "@/lib/trpc";

export default function TrendsPage() {
  const heatQuery = trpc.trends.categoryHeat.useQuery({ days: 30 });
  const metricHistoryQuery = trpc.trends.metricHistory.useQuery({ limit: 12 });
  const signalQuery = trpc.trends.signalFrequency.useQuery({ editionLimit: 8 });

  return (
    <div>
      <PageHeader
        overline="The Desk · Trends"
        title="What's moving"
        kicker="Week-over-week comparison across metrics, categories and signals."
      />

      <div className="space-y-10">
        <SectionErrorBoundary section="Category heat">
          <CategoryHeatChart
            data={heatQuery.data}
            isLoading={heatQuery.isLoading}
          />
        </SectionErrorBoundary>

        <SectionErrorBoundary section="Metric history">
          <MetricHistoryChart
            data={metricHistoryQuery.data}
            isLoading={metricHistoryQuery.isLoading}
          />
        </SectionErrorBoundary>

        <SectionErrorBoundary section="Signal frequency">
          <SignalFrequencyChart
            data={signalQuery.data}
            isLoading={signalQuery.isLoading}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

// ─── Category heat ──────────────────────────────────────────────────────────

function CategoryHeatChart({
  data,
  isLoading,
}: {
  data: Array<{ category: string; total: number; daily: number; weekly: number }> | undefined;
  isLoading: boolean;
}) {
  return (
    <section>
      <p className="overline mb-3">Category heat · last 30 days</p>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No data yet.</p>
      ) : (
        <div className="panel rounded p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis dataKey="category" tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }} />
              <YAxis tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.17 0.018 260)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total">
                {data.map((entry) => (
                  <Cell key={entry.category} fill={categoryColour(entry.category)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

// ─── Metric history ─────────────────────────────────────────────────────────

function MetricHistoryChart({
  data,
  isLoading,
}: {
  data: Array<{ editionNumber: number; weekOf: string; keyMetrics: Record<string, string | number> | null }> | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <section>
        <p className="overline mb-3">Metric history</p>
        <Skeleton className="h-64 w-full rounded" />
      </section>
    );
  }
  if (!data || data.length === 0) {
    return (
      <section>
        <p className="overline mb-3">Metric history</p>
        <p className="text-sm text-[var(--color-fg-muted)]">No editions with metrics yet.</p>
      </section>
    );
  }

  // Pick numeric keys that appear in at least half the editions.
  const metricKeys = pickNumericMetricKeys(data);
  if (metricKeys.length === 0) {
    return (
      <section>
        <p className="overline mb-3">Metric history</p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Stored metrics aren't numeric — no chart to draw.
        </p>
      </section>
    );
  }

  const series = data.map((row) => {
    const next: Record<string, number | string> = { editionNumber: row.editionNumber };
    for (const k of metricKeys) {
      next[k] = toNumber(row.keyMetrics?.[k]);
    }
    return next;
  });

  return (
    <section>
      <p className="overline mb-3">Metric history · last {data.length} editions</p>
      <div className="panel rounded p-4">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="editionNumber"
              tickFormatter={(v) => `#${v}`}
              tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }}
            />
            <YAxis tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.17 0.018 260)",
                border: "1px solid oklch(1 0 0 / 12%)",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
            {metricKeys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CHART_COLOURS[i % CHART_COLOURS.length]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {metricKeys.map((k, i) => (
            <span
              key={k}
              className="overline flex items-center gap-1.5"
              style={{ color: CHART_COLOURS[i % CHART_COLOURS.length] }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CHART_COLOURS[i % CHART_COLOURS.length] }}
              />
              {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const CHART_COLOURS = [
  "oklch(0.75 0.18 70)",
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

function pickNumericMetricKeys(
  rows: Array<{ keyMetrics: Record<string, string | number> | null }>
): string[] {
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
    .map(([k]) => k)
    .slice(0, 5);
}

// ─── Signal frequency ───────────────────────────────────────────────────────

function SignalFrequencyChart({
  data,
  isLoading,
}: {
  data: Array<{ editionNumber: number; weekOf: string; signalCount: number; topicCount: number }> | undefined;
  isLoading: boolean;
}) {
  return (
    <section>
      <p className="overline mb-3">Signals + topics · last {data?.length ?? 0} editions</p>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No editions yet.</p>
      ) : (
        <div className="panel rounded p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis
                dataKey="editionNumber"
                tickFormatter={(v) => `#${v}`}
                tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }}
              />
              <YAxis tick={{ fill: "oklch(0.62 0.012 260)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.17 0.018 260)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="signalCount" fill="oklch(0.75 0.18 70)" />
              <Bar dataKey="topicCount" fill="oklch(0.65 0.18 255)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
