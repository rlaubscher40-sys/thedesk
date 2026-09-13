import { formatMetricValue, metricTiming } from "@shared/metricPresentation";
import { preferenceStorage } from "@/lib/storage";
/**
 * Lightweight intelligence alert.
 *
 * Priority 1: if a metric the reader explicitly watches has moved materially
 * from the value captured when they started watching it, surface that change.
 * Priority 2: otherwise fall back to the day's top editorial signal. Both are
 * dismissible without adding push infrastructure or background polling.
 */
import { useEffect, useMemo, useState } from "react";
import { MoveDownRight, MoveUpRight, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const WATCH_KEY = "thedesk:signal-watchlist:v1";
const WATCH_ALERT_DISMISS_KEY = "thedesk:watch-alert-dismissed:v1";
const MATERIAL_MOVE_PCT = 0.5;

type WatchRecord = {
  metricKey: string;
  baseline: number | null;
  baselineDisplay: string;
  startedAt: string;
};

function readWatchlist(): WatchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(preferenceStorage.getItem(WATCH_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is WatchRecord =>
        item &&
        typeof item.metricKey === "string" &&
        (typeof item.baseline === "number" || item.baseline === null) &&
        typeof item.baselineDisplay === "string" &&
        typeof item.startedAt === "string"
    );
  } catch {
    return [];
  }
}

function parseDisplayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const negative = /^\s*-/.test(value) || /^\s*\(/.test(value);
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function pctMove(first: number, last: number): number {
  if (Math.abs(first) < 0.000001) return last - first;
  return ((last - first) / Math.abs(first)) * 100;
}

const displayMetric = formatMetricValue;

export function BreakingSignalToast() {
  const [watchlist, setWatchlist] = useState<WatchRecord[]>([]);
  const [watchDismissedFingerprint, setWatchDismissedFingerprint] = useState<string | null>(null);

  useEffect(() => {
    setWatchlist(readWatchlist());
    setWatchDismissedFingerprint(preferenceStorage.getItem(WATCH_ALERT_DISMISS_KEY));
  }, []);

  const metrics = trpc.metrics.list.useQuery(undefined, {
    enabled: watchlist.length > 0,
    staleTime: 5 * 60_000,
  });

  const watchAlert = useMemo(() => {
    if (!metrics.data || watchlist.length === 0) return null;
    const candidates = watchlist.flatMap((watch) => {
      if (watch.baseline == null) return [];
      const metric = metrics.data.find((item) => item.metricKey === watch.metricKey);
      if (!metric) return [];
      const current = parseDisplayNumber(metric.value);
      if (current == null) return [];
      const move = pctMove(watch.baseline, current);
      if (Math.abs(move) < MATERIAL_MOVE_PCT) return [];
      return [{ watch, metric, current, move }];
    });
    candidates.sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
    return candidates[0] ?? null;
  }, [metrics.data, watchlist]);

  const watchFingerprint = watchAlert
    ? `${watchAlert.metric.metricKey}:${watchAlert.metric.value}`
    : null;
  const watchVisible = Boolean(
    watchAlert && watchFingerprint && watchFingerprint !== watchDismissedFingerprint
  );

  if (watchVisible && watchAlert && watchFingerprint) {
    const rising = watchAlert.move >= 0;
    const Icon = rising ? MoveUpRight : MoveDownRight;
    const absolute = watchAlert.current - watchAlert.watch.baseline!;
    const moveText =
      watchAlert.metric.unit === "%"
        ? `${absolute > 0 ? "+" : ""}${Number(absolute.toFixed(3))} percentage points`
        : `${rising ? "+" : ""}${watchAlert.move.toFixed(2)}%`;

    return (
      <div
        role="status"
        aria-label="A watched signal moved materially"
        className="flex fixed bottom-[calc(var(--overlay-bottom)+7rem)] left-3 right-3 md:left-auto md:right-6 z-40 md:max-w-sm panel p-4 rounded shadow-xl items-start gap-3"
      >
        <div className="h-7 w-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="overline mb-1">Your signal moved</p>
          <Link
            href="/signals"
            className="text-sm font-medium leading-snug hover:text-amber-300 transition-colors"
          >
            {watchAlert.metric.label}: {displayMetric(watchAlert.metric)}
          </Link>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1.5">
            {moveText} since you started watching at {watchAlert.watch.baselineDisplay}.
          </p>
          <p className="text-xs mt-2">{metricTiming(watchAlert.metric)}</p>
          {watchAlert.metric.context && (
            <p className="text-xs text-[var(--color-fg-subtle)] mt-1 line-clamp-2">
              {watchAlert.metric.context}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            preferenceStorage.setItem(WATCH_ALERT_DISMISS_KEY, watchFingerprint);
            setWatchDismissedFingerprint(watchFingerprint);
          }}
          aria-label="Dismiss watched signal alert"
          className="min-h-11 min-w-11 flex items-center justify-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
