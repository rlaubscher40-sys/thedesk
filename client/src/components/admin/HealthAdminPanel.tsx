/**
 * Admin health dashboard.
 *
 * Two purposes:
 *   1. Surfaces what the app knows that an external uptime/error tool
 *      can't — ingest cadence, subscriber pipeline, env-var coverage.
 *   2. Lets the curator skim recent server errors and a rolling uptime
 *      window from inside the product, no third-party console required.
 *
 * Driven by trpc.health.* procedures, all admin-gated. Polls every
 * 30s while the panel is visible so a freshly-ingested edition or a
 * just-thrown error appears without a manual refresh.
 */
import { useState } from "react";
import { AlertTriangle, Heart, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function HealthAdminPanel() {
  const summaryQuery = trpc.health.summary.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const errorsQuery = trpc.health.recentErrors.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const pingsQuery = trpc.health.uptimePings.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const utils = trpc.useUtils();
  const clearErrors = trpc.health.clearErrors.useMutation({
    onSuccess: () => {
      toast.success("Error log cleared");
      utils.health.recentErrors.invalidate();
      utils.health.summary.invalidate();
    },
    onError: (err) => toast.error(err.message || "Couldn't clear"),
  });

  const summary = summaryQuery.data;
  const errors = errorsQuery.data ?? [];
  const pings = pingsQuery.data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-7">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="overline-amber mb-2"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Health
          </p>
          <h2 className="font-serif text-2xl font-bold leading-tight">
            Service status
          </h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
            What the app knows about itself: env coverage, ingest cadence,
            subscriber pipeline, errors, uptime. Polls every 30 seconds.
          </p>
        </div>
        <button
          onClick={() => {
            utils.health.summary.invalidate();
            utils.health.recentErrors.invalidate();
            utils.health.uptimePings.invalidate();
            toast.message("Refreshed");
          }}
          className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] hover:border-[var(--color-amber)]/40 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </header>

      {summary && (
        <>
          {/* Top-level stat grid: errors and uptime. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Errors · 24h"
              value={String(summary.errors.last24h).padStart(2, "0")}
              hint={summary.errors.last24h === 0 ? "Quiet" : "See log below"}
              alert={summary.errors.last24h > 0}
            />
            <StatTile
              label="Errors · 7d"
              value={String(summary.errors.last7d).padStart(2, "0")}
            />
            <StatTile
              label="Uptime · 24h"
              value={
                summary.uptime.last24h.percent !== null
                  ? `${summary.uptime.last24h.percent.toFixed(1)}%`
                  : "—"
              }
              hint={
                summary.uptime.last24h.total
                  ? `${summary.uptime.last24h.total} pings · ${summary.uptime.last24h.avgLatencyMs}ms avg`
                  : "No pings yet"
              }
            />
            <StatTile
              label="Uptime · 7d"
              value={
                summary.uptime.last7d.percent !== null
                  ? `${summary.uptime.last7d.percent.toFixed(1)}%`
                  : "—"
              }
              hint={
                summary.uptime.last7d.total
                  ? `${summary.uptime.last7d.total} pings`
                  : "No pings yet"
              }
            />
          </div>

          {/* Two-column: env coverage + ingest + subscribers. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EnvCoverage env={summary.env} />
            <IngestPanel ingest={summary.ingest} />
            <SubscriberPipeline subs={summary.subscribers} />
          </div>
        </>
      )}

      {/* Uptime sparkline. */}
      {pings.length > 0 && <UptimeSparkline pings={pings} />}

      {/* Error log. */}
      <ErrorLog
        errors={errors}
        onClear={() => {
          if (!confirm("Clear every entry from server_errors? This can't be undone.")) return;
          clearErrors.mutate();
        }}
        clearing={clearErrors.isPending}
      />
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className="panel rounded-sm p-4"
      style={
        alert
          ? {
              background: "color-mix(in oklch, var(--color-ink) 8%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--color-ink) 30%, transparent)",
            }
          : undefined
      }
    >
      <p
        className="font-mono uppercase text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <p
        className="font-mono mt-2 tabular-nums"
        style={{
          fontSize: "22px",
          letterSpacing: "0.02em",
          color: alert ? "var(--color-ink-bright)" : "var(--color-fg)",
        }}
      >
        {value}
      </p>
      {hint && (
        <p
          className="font-mono text-[var(--color-fg-subtle)] mt-1"
          style={{ fontSize: "10px", letterSpacing: "0.04em" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function EnvCoverage({ env }: { env: Record<string, boolean> }) {
  const rows: Array<[string, string]> = [
    ["database", "DATABASE_URL"],
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["openai", "OPENAI_API_KEY"],
    ["sentry", "SENTRY_DSN"],
    ["resend", "RESEND_API_KEY"],
    ["plausible", "VITE_PLAUSIBLE_DOMAIN"],
    ["siteUrl", "SITE_URL"],
    ["scheduledKey", "SCHEDULED_API_KEY"],
  ];
  return (
    <div className="space-y-2.5">
      <h3
        className="font-mono uppercase text-[var(--color-fg-muted)]"
        style={{ fontSize: "11px", letterSpacing: "0.22em" }}
      >
        Environment
      </h3>
      <ul className="space-y-1.5">
        {rows.map(([key, label]) => {
          const set = env[key];
          return (
            <li key={key} className="flex items-center justify-between gap-3">
              <span
                className="font-mono text-[var(--color-fg-muted)]"
                style={{ fontSize: "11px", letterSpacing: "0.04em" }}
              >
                {label}
              </span>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  color: set ? "var(--color-amber-bright)" : "var(--color-fg-subtle)",
                }}
              >
                {set ? "Set" : "Unset"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IngestPanel({
  ingest,
}: {
  ingest: {
    latestEditionPublishedAt: Date | null;
    latestEditionNumber: number | null;
    latestFeedItemAt: Date | null;
    latestFeedItemTitle: string | null;
    latestMetricAt: Date | null;
  };
}) {
  return (
    <div className="space-y-2.5">
      <h3
        className="font-mono uppercase text-[var(--color-fg-muted)]"
        style={{ fontSize: "11px", letterSpacing: "0.22em" }}
      >
        Last ingest
      </h3>
      <IngestRow
        label="Edition"
        primary={
          ingest.latestEditionNumber
            ? `No. ${ingest.latestEditionNumber}`
            : "None yet"
        }
        timestamp={ingest.latestEditionPublishedAt}
      />
      <IngestRow
        label="Daily feed"
        primary={ingest.latestFeedItemTitle?.slice(0, 48) ?? "None yet"}
        timestamp={ingest.latestFeedItemAt}
      />
      <IngestRow
        label="Metric"
        primary={ingest.latestMetricAt ? "Live" : "None yet"}
        timestamp={ingest.latestMetricAt}
      />
    </div>
  );
}

function IngestRow({
  label,
  primary,
  timestamp,
}: {
  label: string;
  primary: string;
  timestamp: Date | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono uppercase text-[var(--color-fg-subtle)]"
          style={{ fontSize: "10px", letterSpacing: "0.22em" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[var(--color-fg-subtle)]"
          style={{ fontSize: "10px" }}
        >
          {timestamp ? relativeAge(timestamp) : "—"}
        </span>
      </div>
      <p className="font-serif text-sm text-[var(--color-fg)] mt-0.5 truncate">
        {primary}
      </p>
    </div>
  );
}

function SubscriberPipeline({
  subs,
}: {
  subs: {
    total: number;
    confirmed: number;
    pendingConfirm: number;
    unsubscribed: number;
  };
}) {
  const rows: Array<[string, number]> = [
    ["Confirmed", subs.confirmed],
    ["Pending confirm", subs.pendingConfirm],
    ["Unsubscribed", subs.unsubscribed],
    ["Total ever", subs.total],
  ];
  return (
    <div className="space-y-2.5">
      <h3
        className="font-mono uppercase text-[var(--color-fg-muted)]"
        style={{ fontSize: "11px", letterSpacing: "0.22em" }}
      >
        Subscribers
      </h3>
      <ul className="space-y-1.5">
        {rows.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <span
              className="font-mono text-[var(--color-fg-muted)]"
              style={{ fontSize: "11px", letterSpacing: "0.04em" }}
            >
              {label}
            </span>
            <span
              className="font-mono text-[var(--color-fg)] tabular-nums"
              style={{ fontSize: "12px", letterSpacing: "0.02em" }}
            >
              {value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UptimeSparkline({
  pings,
}: {
  pings: Array<{ id: number; pingedAt: Date; statusCode: number; latencyMs: number }>;
}) {
  // Newest-first → render right-to-left so the most recent ping sits
  // on the right edge of the sparkline.
  const ordered = pings.slice(0, 60).reverse();
  const max = Math.max(50, ...ordered.map((p) => p.latencyMs));
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3
          className="font-mono uppercase text-[var(--color-fg-muted)]"
          style={{ fontSize: "11px", letterSpacing: "0.22em" }}
        >
          Recent pings
        </h3>
        <span
          className="font-mono text-[var(--color-fg-subtle)]"
          style={{ fontSize: "10px", letterSpacing: "0.04em" }}
        >
          {ordered.length} of {pings.length}
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-12">
        {ordered.map((p) => {
          const ok = p.statusCode >= 200 && p.statusCode < 300;
          const heightPct = Math.max(8, Math.round((p.latencyMs / max) * 100));
          return (
            <div
              key={p.id}
              title={`${new Date(p.pingedAt).toLocaleString()} · ${p.statusCode} · ${p.latencyMs}ms`}
              style={{
                width: 5,
                height: `${heightPct}%`,
                background: ok
                  ? "var(--color-amber)"
                  : "var(--color-ink-bright)",
                opacity: 0.7,
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ErrorLog({
  errors,
  onClear,
  clearing,
}: {
  errors: Array<{
    id: number;
    occurredAt: Date;
    message: string;
    stack: string | null;
    method: string | null;
    route: string | null;
  }>;
  onClear: () => void;
  clearing: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3
          className="font-mono uppercase text-[var(--color-fg-muted)]"
          style={{ fontSize: "11px", letterSpacing: "0.22em" }}
        >
          Recent errors
        </h3>
        {errors.length > 0 && (
          <button
            onClick={onClear}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-mono uppercase tracking-[0.18em] text-[var(--color-fg-subtle)] hover:text-[var(--color-ink-bright)] transition-colors disabled:opacity-50"
            style={{ fontSize: "10px" }}
          >
            <Trash2 className="h-3 w-3" />
            Clear log
          </button>
        )}
      </div>
      {errors.length === 0 ? (
        <div
          className="panel rounded-sm p-5 flex items-center gap-2.5"
          style={{
            background:
              "color-mix(in oklch, var(--color-amber) 5%, transparent)",
          }}
        >
          <Heart
            className="h-3.5 w-3.5"
            style={{ color: "var(--color-amber)" }}
          />
          <p
            className="font-serif italic text-[var(--color-fg-muted)]"
            style={{ fontSize: "14px" }}
          >
            No errors recorded. The desk is quiet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {errors.map((e) => (
            <li key={e.id} className="panel rounded-sm p-3.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                <span
                  className="font-mono uppercase text-[var(--color-ink-bright)]"
                  style={{ fontSize: "10px", letterSpacing: "0.18em" }}
                >
                  <AlertTriangle className="inline h-3 w-3 mr-1 align-[-2px]" />
                  {e.method ?? "—"} {e.route ?? "(unmatched route)"}
                </span>
                <span
                  className="font-mono text-[var(--color-fg-subtle)]"
                  style={{ fontSize: "10px" }}
                >
                  {relativeAge(e.occurredAt)}
                </span>
              </div>
              <p
                className="font-serif text-[var(--color-fg)] leading-snug"
                style={{ fontSize: "14px" }}
              >
                {e.message}
              </p>
              {e.stack && (
                <details className="mt-2">
                  <summary
                    className="cursor-pointer font-mono uppercase text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                    style={{ fontSize: "10px", letterSpacing: "0.18em" }}
                  >
                    Stack
                  </summary>
                  <pre
                    className="mt-2 font-mono text-[var(--color-fg-muted)] overflow-x-auto whitespace-pre-wrap"
                    style={{ fontSize: "11px", lineHeight: 1.5 }}
                  >
                    {e.stack}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function relativeAge(d: Date | string): string {
  const ts = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
