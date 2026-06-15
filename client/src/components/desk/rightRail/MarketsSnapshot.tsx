/**
 * Compact, always-visible markets snapshot for the Today right rail. The
 * full "Where things stand" dashboard still lives in a collapsible band at
 * the foot of the page; this is the ambient, glanceable version that fills
 * the rail on wide screens (the role Perplexity's "Market Outlook" card
 * plays on Discover).
 *
 * Prefers the MARKETS-grouped metrics, falls back to the first few tiles, and
 * renders nothing when there's no live metric data so the rail just collapses.
 */
import { Link } from "wouter";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import type { DailyMetric } from "@shared/types";
import { resolveMetricTrend } from "@/lib/metrics";
import { trpc } from "@/lib/trpc";
import { RailPanel } from "./RailPanel";

const SNAPSHOT_COUNT = 5;

export function MarketsSnapshot() {
  const { data: metrics } = trpc.metrics.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  if (!metrics || metrics.length === 0) return null;

  // Lead with the markets lane when it's tagged, otherwise just take the
  // first handful — either way it's a snapshot, not the full board.
  const marketsFirst = [...metrics].sort((a, b) => {
    const am = (a.groupKey ?? "").toUpperCase() === "MARKETS" ? 0 : 1;
    const bm = (b.groupKey ?? "").toUpperCase() === "MARKETS" ? 0 : 1;
    return am - bm;
  });
  const tiles = marketsFirst.slice(0, SNAPSHOT_COUNT);

  return (
    <RailPanel overline="Market snapshot">
      <ul className="space-y-3">
        {tiles.map((m) => (
          <SnapshotRow key={m.metricKey} metric={m} />
        ))}
      </ul>
      <Link
        href="/trends"
        className="inline-flex items-center gap-1.5 overline-amber mt-5 hover:text-amber-200 transition-colors"
      >
        Full market board
        <ArrowRight className="h-3 w-3" />
      </Link>
    </RailPanel>
  );
}

function SnapshotRow({ metric }: { metric: DailyMetric }) {
  const value =
    metric.unit === "%"
      ? `${metric.value}%`
      : metric.unit
        ? `${metric.value}${metric.unit}`
        : metric.value;
  const prior =
    metric.previousValue != null
      ? metric.unit === "%"
        ? `${metric.previousValue}%`
        : `${metric.previousValue}`
      : null;
  const { hasDelta, delta, trend, sentiment, colour } = resolveMetricTrend(
    metric.label,
    value,
    prior
  );
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span
        className="overline text-[var(--color-fg-muted)] truncate"
        style={{ letterSpacing: "0.14em" }}
        title={metric.label}
      >
        {metric.label}
      </span>
      <span className="flex items-baseline gap-2 shrink-0">
        <span className="font-mono text-sm tabular-nums text-[var(--color-fg)]">{value}</span>
        <span
          className="inline-flex items-center gap-0.5 font-mono tabular-nums"
          style={{ color: colour, fontSize: "10px" }}
          aria-label={`${trend} versus prior, ${sentiment}`}
        >
          <Icon className="h-3 w-3" strokeWidth={2.5} />
          {hasDelta && trend !== "flat" && (
            <span>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(Math.abs(delta) < 1 ? 3 : 2)}
            </span>
          )}
        </span>
      </span>
    </li>
  );
}
