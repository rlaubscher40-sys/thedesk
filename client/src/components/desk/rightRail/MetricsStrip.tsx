/**
 * Full-width macro dashboard. Tiles are grouped into editorial sections
 * (MACRO / PROPERTY / LABOUR / MARKETS / DEMOGRAPHICS) when the data is
 * tagged with a `groupKey`. Each tile carries a value, direction arrow,
 * delta vs prior, and a short editorial context blurb in mono.
 *
 * Falls back to a flat layout (and to the curated seed metrics) when the
 * DB hasn't been populated yet.
 *
 * Collapsed by default on mobile so the lead story isn't pushed below
 * the fold. The expanded/collapsed choice persists in localStorage so a
 * reader's preference sticks across visits and viewports.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import type { DailyMetric } from "@shared/types";
import { editionMeta, metrics as seedMetrics } from "@/data/editions/2026-05-15";
import { resolveMetricTrend } from "@/lib/metrics";
import { trpc } from "@/lib/trpc";
import { Sparkline } from "./Sparkline";

const STORAGE_KEY = "thedesk:metrics-strip-expanded";

type Tile = {
  key: string;
  value: string;
  prior: string | null;
  context?: string | null;
  groupKey?: string | null;
  /** 30-day numeric series for the sparkline. Empty until history exists. */
  history?: number[];
};

const GROUP_ORDER = ["MACRO", "PROPERTY", "LABOUR", "MARKETS", "DEMOGRAPHICS"];
const GROUP_LABELS: Record<string, string> = {
  MACRO: "Macro & rates",
  PROPERTY: "Property",
  LABOUR: "Labour & wages",
  MARKETS: "Markets",
  DEMOGRAPHICS: "Demographics",
};

/**
 * Read the persisted expanded preference. If none is set, expand by
 * default on desktop and collapse on mobile so the stories land sooner
 * on the smaller screens where the dashboard pushes them well below
 * the fold.
 */
function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.innerWidth >= 768;
}

export function MetricsStrip() {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  const { data: liveMetrics } = trpc.metrics.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  // Sparkline history. Cached longer, daily ingest writes one point a day.
  const { data: histories } = trpc.metrics.histories.useQuery(undefined, {
    staleTime: 30 * 60_000,
  });

  const liveTiles: Tile[] =
    liveMetrics?.map((m: DailyMetric) => ({
      key: m.label,
      value: m.unit && m.unit !== "%" ? `${m.value}${m.unit}` : m.unit === "%" ? `${m.value}${m.unit}` : m.value,
      prior:
        m.previousValue != null
          ? m.unit === "%"
            ? `${m.previousValue}${m.unit}`
            : m.previousValue
          : null,
      context: m.context,
      groupKey: m.groupKey,
      history: histories?.[m.metricKey]?.map((p) => p.value) ?? [],
    })) ?? [];

  const hasLive = liveTiles.length > 0;
  const tiles: Tile[] = hasLive
    ? liveTiles
    : seedMetrics.map((m) => ({
        key: m.key,
        value: m.value,
        prior: m.prior ?? null,
        context: m.detail ?? null,
      }));

  // Group tiles when groupKey is set on enough of them. Otherwise flat.
  const grouped = groupTiles(tiles);
  const headerRight = hasLive
    ? "Live · refreshed daily"
    : `Edition ${editionMeta.number} · ${editionMeta.date}`;
  const tileCount = tiles.length;

  return (
    <section
      className="panel rounded-sm overflow-hidden"
      aria-label="Where things stand"
    >
      {/* Header is the whole tap target so a thumb on mobile doesn't have
          to land on the chevron specifically. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="metrics-strip-body"
        className="w-full px-6 py-4 border-b border-[var(--color-border)] flex items-baseline justify-between flex-wrap gap-3 text-left hover:bg-white/[0.02] transition-colors"
        style={{ borderBottomWidth: expanded ? 1 : 0 }}
      >
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-none">
            Where things stand
          </h2>
          {!expanded && tileCount > 0 && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]"
            >
              {tileCount} metric{tileCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p
            className="overline text-[var(--color-fg-subtle)]"
            style={{ letterSpacing: "0.18em" }}
          >
            {headerRight}
          </p>
          <ChevronDown
            className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            aria-hidden="true"
          />
        </div>
      </button>

      {expanded && (
        <div id="metrics-strip-body">
          {grouped.map((group, groupIdx) => (
            <div key={group.label ?? `g-${groupIdx}`}>
              {group.label && (
                <div className="px-6 pt-5 pb-2 border-t border-[var(--color-border)] first:border-t-0 flex items-center gap-3">
                  <p
                    className="overline-amber"
                    style={{ letterSpacing: "0.22em", fontSize: "10px" }}
                  >
                    {group.label}
                  </p>
                  <span
                    className="block flex-1 h-px bg-[var(--color-border)]"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {group.tiles.map((m, idx) => (
                  <Tile key={m.key + idx} tile={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Tile({ tile }: { tile: Tile }) {
  const { hasDelta, delta, trend, sentiment, colour } = resolveMetricTrend(
    tile.key,
    tile.value,
    tile.prior
  );
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  return (
    <div className="p-4 sm:p-5 lg:p-6 border-t border-l border-[var(--color-border)] -mt-px -ml-px">
      <p
        className="overline mb-2 truncate"
        style={{ letterSpacing: "0.18em", fontSize: "10px" }}
        title={tile.key}
      >
        {tile.key}
      </p>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="font-serif text-2xl lg:text-[28px] font-bold tabular-nums text-[var(--color-fg)] leading-none">
          {tile.value}
        </p>
        <span
          className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0"
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
      </div>
      {tile.history && tile.history.length >= 2 && (
        <div className="mb-2 opacity-80">
          <Sparkline values={tile.history} width={120} height={20} />
        </div>
      )}
      {tile.context && (
        <p
          className="font-mono text-[10px] text-[var(--color-fg-subtle)] leading-relaxed line-clamp-2"
          title={tile.context}
        >
          {tile.context}
        </p>
      )}
    </div>
  );
}

function groupTiles(tiles: Tile[]): Array<{ label: string | null; tiles: Tile[] }> {
  const hasGroups = tiles.filter((t) => t.groupKey).length >= Math.min(4, tiles.length);
  if (!hasGroups) return [{ label: null, tiles }];
  const byKey = new Map<string, Tile[]>();
  for (const t of tiles) {
    const k = (t.groupKey ?? "OTHER").toUpperCase();
    const arr = byKey.get(k) ?? [];
    arr.push(t);
    byKey.set(k, arr);
  }
  return GROUP_ORDER.flatMap((k) => {
    const list = byKey.get(k);
    if (!list) return [];
    return [{ label: GROUP_LABELS[k] ?? k, tiles: list }];
  }).concat(
    Array.from(byKey.entries())
      .filter(([k]) => !GROUP_ORDER.includes(k))
      .map(([k, ts]) => ({ label: GROUP_LABELS[k] ?? k, tiles: ts }))
  );
}
