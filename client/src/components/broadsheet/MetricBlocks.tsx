/**
 * The numbers, in broadsheet dress.
 *
 * Three surfaces share one data hook so they can't disagree with each
 * other: the "Where things stand" band on Today, the cash-rate panel in
 * the Today lead rail and the Story rail, and the compact metric rows
 * beneath it.
 *
 * Everything here is wired to `metrics.list` + `metrics.histories`. No
 * value, delta, series or note is hardcoded — a metric with no history
 * renders without a chart rather than with an invented one.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { DailyMetric } from "@shared/types";
import { cn } from "@/lib/cn";
import { resolveMetricTrend, type Sentiment } from "@/lib/metrics";
import { trpc } from "@/lib/trpc";
import { BarSeries, MetricSparkline, StepChart } from "@/components/charts/BroadsheetCharts";
import { GUTTER_X } from "./tokens";

const EXPANDED_KEY = "thedesk:metrics-strip-expanded";

export type MetricTile = {
  metricKey: string;
  label: string;
  value: string;
  prior: string | null;
  context: string | null;
  history: number[];
  delta: number;
  hasDelta: boolean;
  trend: "up" | "down" | "flat";
  sentiment: Sentiment;
};

/** Metrics whose series reads better as discrete bars than as a line —
 *  weekly clearance rates, monthly roll-off volumes, listing counts. */
const BAR_SERIES_RE = /(clearance|roll-?off|listing|approval|volume|starts)/i;

/** All metrics for the day, each resolved into a render-ready tile. */
export function useMetricTiles(): { tiles: MetricTile[]; isLoading: boolean } {
  const metricsQuery = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const historiesQuery = trpc.metrics.histories.useQuery(undefined, {
    staleTime: 30 * 60_000,
  });

  const tiles = useMemo(() => {
    const histories = historiesQuery.data;
    return (metricsQuery.data ?? []).map((m: DailyMetric): MetricTile => {
      const suffix = m.unit ?? "";
      const value = suffix ? `${m.value}${suffix}` : m.value;
      const prior = m.previousValue != null ? `${m.previousValue}${suffix}` : null;
      const { delta, hasDelta, trend, sentiment } = resolveMetricTrend(
        m.label,
        value,
        prior
      );
      return {
        metricKey: m.metricKey,
        label: m.label,
        value,
        prior,
        context: m.context ?? null,
        history: histories?.[m.metricKey]?.map((p) => p.value) ?? [],
        delta,
        hasDelta,
        trend,
        sentiment,
      };
    });
  }, [metricsQuery.data, historiesQuery.data]);

  return { tiles, isLoading: metricsQuery.isLoading };
}

/** The cash-rate tile, if the ingest has produced one. */
export function useCashRate(tiles: MetricTile[]): MetricTile | undefined {
  return useMemo(() => tiles.find((t) => /cash rate/i.test(t.label)), [tiles]);
}

function DeltaChip({ tile }: { tile: MetricTile }) {
  if (!tile.hasDelta || tile.trend === "flat") return null;
  const arrow = tile.trend === "up" ? "▲" : "▼";
  return (
    <span
      className="font-mono tabular-nums shrink-0"
      style={{ fontSize: 11, color: `var(--sentiment-${tile.sentiment})` }}
      aria-label={`${tile.trend} versus prior`}
    >
      {arrow} {Math.abs(tile.delta).toFixed(Math.abs(tile.delta) < 1 ? 2 : 2)}
    </span>
  );
}

/** The 40px chart under a metric value: bars or a line, by metric shape. */
function TileChart({ tile }: { tile: MetricTile }) {
  if (tile.history.length < 2) return null;
  if (BAR_SERIES_RE.test(tile.label)) {
    return (
      <BarSeries
        values={tile.history}
        sentiment={tile.sentiment}
        label={`${tile.label}, recent series`}
      />
    );
  }
  return (
    <MetricSparkline
      values={tile.history}
      sentiment={tile.sentiment}
      label={`${tile.label}, 30-day trend`}
    />
  );
}

/**
 * "Where things stand" — four hairline-divided columns under a major
 * rule. Expanded by default (the collapsed strip buried the most
 * credible content in the product), but the reader's collapse choice
 * still persists.
 */
export function WhereThingsStand({ limit = 4 }: { limit?: number }) {
  const { tiles } = useMetricTiles();
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(EXPANDED_KEY) !== "0";
  });

  useEffect(() => {
    window.localStorage.setItem(EXPANDED_KEY, expanded ? "1" : "0");
  }, [expanded]);

  if (tiles.length === 0) return null;
  const shown = tiles.slice(0, limit);

  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-7")} aria-label="Where things stand">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <h2 className="font-serif font-bold" style={{ fontSize: 34, lineHeight: 1.06 }}>
          Where things stand
        </h2>
        <div className="flex items-baseline gap-5">
          <p className="bs-label">Refreshed daily · 7am AEST</p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="bs-label bs-link"
          >
            {expanded ? "Collapse" : `Show ${shown.length}`}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((tile, i) => (
            <div
              key={tile.metricKey}
              className={cn(
                "min-w-0",
                // Symmetric column padding with hairlines between, never
                // gaps between floating cards.
                i > 0 && "lg:rule-hair-l lg:pl-7",
                i < shown.length - 1 && "lg:pr-7"
              )}
            >
              <p className="bs-label truncate" style={{ letterSpacing: "0.18em" }} title={tile.label}>
                {tile.label}
              </p>
              <div className="flex items-baseline gap-2.5 mt-2">
                <p
                  className="font-serif font-bold tabular-nums"
                  style={{ fontSize: 40, lineHeight: 1 }}
                >
                  {tile.value}
                </p>
                <DeltaChip tile={tile} />
              </div>
              <div className="mt-2.5">
                <TileChart tile={tile} />
              </div>
              {tile.context && (
                <p
                  className="font-mono mt-2 text-[var(--color-fg-subtle)]"
                  style={{ fontSize: 10, lineHeight: 1.5 }}
                >
                  {tile.context}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Cash-rate panel — the headline figure over its step chart. Sits in the
 * Today lead rail and again in the Story rail.
 */
export function CashRatePanel({
  compact = false,
  showAllLink = true,
}: {
  /** Story rail: smaller figure, no header row. */
  compact?: boolean;
  showAllLink?: boolean;
}) {
  const { tiles } = useMetricTiles();
  const cashRate = useCashRate(tiles);
  if (!cashRate) return null;

  // The series the chart draws is whatever history the ingest has written
  // for this metric — no synthetic four-year path.
  const points = cashRate.history.map((value, i) => ({ t: i, value }));
  const ticks =
    points.length >= 2
      ? [
          { t: points[0]!.t, label: `${points.length}d ago` },
          { t: points[points.length - 1]!.t, label: "Today" },
        ]
      : [];

  return (
    <div>
      {!compact && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="bs-label" style={{ letterSpacing: "0.22em" }}>
            {cashRate.label}
          </p>
          <p className="bs-label" style={{ letterSpacing: "0.14em" }}>
            RBA
          </p>
        </div>
      )}
      <div className="flex items-end gap-3.5 mt-3">
        <p
          className="font-serif font-bold tabular-nums"
          style={{ fontSize: compact ? 46 : 52, lineHeight: 0.9 }}
        >
          {cashRate.value}
        </p>
        {cashRate.context && (
          <p className="bs-label mb-2 max-w-[16ch]" style={{ letterSpacing: "0.14em", lineHeight: 1.5 }}>
            {cashRate.context}
          </p>
        )}
      </div>
      <div className="mt-3.5">
        <StepChart
          points={points}
          ticks={ticks}
          height={compact ? 96 : 118}
          label={`${cashRate.label} over the recorded series, currently ${cashRate.value}`}
        />
      </div>
      {showAllLink && (
        <Link
          href="/trends"
          className="bs-label bs-link rule-hair mt-5 pt-4 flex items-center justify-between"
          style={{ color: "var(--color-accent-text)" }}
        >
          <span>All {tiles.length} indicators</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

/**
 * Compact metric rows for a rail: label left, value + arrow right, on
 * hairlines. Skips the cash rate, which the panel above already carries.
 */
export function MetricRows({ limit = 4 }: { limit?: number }) {
  const { tiles } = useMetricTiles();
  const rows = tiles.filter((t) => !/cash rate/i.test(t.label)).slice(0, limit);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3.5">
      {rows.map((tile, i) => (
        <div
          key={tile.metricKey}
          className={cn(
            "rule-hair flex items-baseline justify-between gap-4 py-2.5",
            i === rows.length - 1 && "rule-hair-b"
          )}
        >
          <span className="bs-label truncate" style={{ letterSpacing: "0.16em" }}>
            {tile.label}
          </span>
          <span className="font-serif tabular-nums shrink-0" style={{ fontSize: 20 }}>
            {tile.value}{" "}
            {tile.hasDelta && tile.trend !== "flat" && (
              <span
                className="font-mono"
                style={{ fontSize: 10, color: `var(--sentiment-${tile.sentiment})` }}
              >
                {tile.trend === "up" ? "▲" : "▼"}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
