/**
 * Self-hosted readership analytics. Replaces the Plausible tile.
 *
 * Reads aggregates from trpc.analytics.* — all admin-gated. Three
 * blocks of information:
 *   1. Stat tiles: views & sessions over 24h / 7d / 30d.
 *   2. Top paths and top referrers over the same window.
 *   3. Per-day sparkline across 30 days.
 *
 * No third-party JS, no cookies; the underlying page_views table
 * stores path + ephemeral session token + hostname-only referrer.
 */
import { BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function AnalyticsAdminPanel() {
  const summaryQuery = trpc.analytics.summary.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const breakdownQuery = trpc.analytics.breakdown.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const byDayQuery = trpc.analytics.byDay.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });

  const summary = summaryQuery.data;
  const breakdown = breakdownQuery.data;
  const byDay = byDayQuery.data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-7">
      <header>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          <BarChart3 className="inline h-3 w-3 mr-1.5 align-[-2px]" />
          Analytics
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">
          Readers
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Self-hosted page-view counts. Cookieless, no third-party
          script, no IP storage. Sessions reset when the tab closes.
        </p>
      </header>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Tile
            label="Views · 24h"
            value={summary.window.views.toLocaleString("en-AU")}
            hint={`${summary.window.sessions} session${summary.window.sessions === 1 ? "" : "s"}`}
          />
          <Tile
            label="Views · 7d"
            value={summary.last7d.views.toLocaleString("en-AU")}
            hint={`${summary.last7d.sessions} sessions`}
          />
          <Tile
            label="Views · 30d"
            value={summary.last30d.views.toLocaleString("en-AU")}
            hint={`${summary.last30d.sessions} sessions`}
          />
        </div>
      )}

      {byDay.length > 0 && <DailySparkline rows={byDay} />}

      {breakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakdownList
            title="Top paths · 24h"
            rows={breakdown.paths.map((p) => ({ key: p.path, views: p.views }))}
            emptyHint="No views yet."
          />
          <BreakdownList
            title="Top referrers · 24h"
            rows={breakdown.referrers.map((r) => ({
              key: r.referrer,
              views: r.views,
            }))}
            emptyHint="No external referrers yet."
          />
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel rounded-sm p-4">
      <p
        className="font-mono uppercase text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <p
        className="font-mono mt-2 tabular-nums text-[var(--color-fg)]"
        style={{ fontSize: "22px", letterSpacing: "0.02em" }}
      >
        {value}
      </p>
      {hint && (
        <p
          className="font-mono text-[var(--color-fg-subtle)] mt-1"
          style={{ fontSize: "10px" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function BreakdownList({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: Array<{ key: string; views: number }>;
  emptyHint: string;
}) {
  return (
    <div className="space-y-2.5">
      <h3
        className="font-mono uppercase text-[var(--color-fg-muted)]"
        style={{ fontSize: "11px", letterSpacing: "0.22em" }}
      >
        {title}
      </h3>
      {rows.length === 0 ? (
        <p
          className="font-serif italic text-[var(--color-fg-subtle)]"
          style={{ fontSize: "13px" }}
        >
          {emptyHint}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3">
              <span
                className="font-mono text-[var(--color-fg-muted)] truncate"
                style={{ fontSize: "11px", letterSpacing: "0.02em" }}
                title={r.key}
              >
                {r.key}
              </span>
              <span
                className="font-mono text-[var(--color-fg)] tabular-nums shrink-0"
                style={{ fontSize: "12px", letterSpacing: "0.02em" }}
              >
                {r.views.toLocaleString("en-AU")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DailySparkline({ rows }: { rows: Array<{ day: string; views: number }> }) {
  // Server returns newest-first; reverse for left-to-right rendering.
  const ordered = [...rows].reverse();
  const max = Math.max(1, ...ordered.map((r) => r.views));
  return (
    <div className="space-y-2.5">
      <h3
        className="font-mono uppercase text-[var(--color-fg-muted)]"
        style={{ fontSize: "11px", letterSpacing: "0.22em" }}
      >
        Last {ordered.length} day{ordered.length === 1 ? "" : "s"}
      </h3>
      <div className="flex items-end gap-1 h-16">
        {ordered.map((r) => {
          const pct = Math.max(6, Math.round((r.views / max) * 100));
          return (
            <div
              key={r.day}
              title={`${r.day} · ${r.views.toLocaleString("en-AU")} views`}
              style={{
                flex: 1,
                minWidth: 4,
                height: `${pct}%`,
                background: "var(--color-amber)",
                opacity: 0.75,
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
