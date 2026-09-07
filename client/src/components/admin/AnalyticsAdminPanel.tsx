/**
 * Self-hosted readership + product-loop analytics.
 *
 * Page views remain cookieless and fingerprint-free. High-value intelligence
 * actions are reported through a fixed event allow-list so we can measure the
 * loop we are trying to grow (watch → ask → share) without collecting question
 * text, market names or other user-entered content.
 */
import { BarChart3, Share2 } from "lucide-react";
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
  const engagementQuery = trpc.analytics.engagement.useQuery(
    { hours: 24 * 7 },
    { refetchInterval: 60_000 }
  );

  const summary = summaryQuery.data;
  const breakdown = breakdownQuery.data;
  const byDay = byDayQuery.data ?? [];
  const engagement = engagementQuery.data ?? [];

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
        <h2 className="font-serif text-2xl font-bold leading-tight">Readers + product loop</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[68ch]">
          Self-hosted page views and a small allow-list of product actions. No cookies, third-party
          scripts or IP storage. Sessions reset when the tab closes; event rows contain no question
          text, market names or metric values.
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

      {engagement.length > 0 && (
        <div className="rule-hair rule-hair-b py-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />
            <h3
              className="font-mono uppercase text-[var(--color-fg-muted)]"
              style={{ fontSize: "11px", letterSpacing: "0.22em" }}
            >
              Intelligence actions · 7d
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--color-border)]">
            {engagement.map((row) => (
              <div key={`${row.event}-${row.surface ?? "all"}`} className="bg-[var(--color-bg-elevated)] p-4">
                <p className="font-mono uppercase text-[10px] tracking-[0.16em] text-[var(--color-fg-subtle)]">
                  {eventLabel(row.event)}{row.surface ? ` · ${row.surface}` : ""}
                </p>
                <div className="flex items-end gap-3 mt-2">
                  <p className="font-serif text-3xl font-bold tabular-nums leading-none">
                    {row.count.toLocaleString("en-AU")}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--color-fg-subtle)] pb-0.5">
                    {row.sessions} session{row.sessions === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
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

function eventLabel(value: string): string {
  const labels: Record<string, string> = {
    ask_query: "Ask query",
    ask_share: "Ask shared",
    market_watch: "Market watched",
    signal_watch: "Signal watched",
    signal_share: "Signal shared",
    story_share: "Story shared",
    take_share: "Desk Take shared",
    brief_reshare: "Brief re-shared",
  };
  return labels[value] ?? value.replace(/_/g, " ");
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
