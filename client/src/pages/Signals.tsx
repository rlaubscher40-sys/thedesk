import { NswPlanningPanel } from "@/components/planning/NswPlanningRead";
import { Bookmark, BookmarkCheck, LineChart, MoveDownRight, MoveUpRight, Radio } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { ShareSignalCardButton } from "@/components/signals/ShareSignalCardButton";
import { ShareMetricCardButton } from "@/components/trends/ShareMetricCardButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

const WATCH_KEY = "thedesk:signal-watchlist:v1";

type WatchRecord = {
  metricKey: string;
  baseline: number | null;
  baselineDisplay: string;
  startedAt: string;
};

function parseDisplayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const negative = /^\s*-/.test(value) || /^\s*\(/.test(value);
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function displayValue(metric: { value: string; unit?: string | null }): string {
  const unit = metric.unit?.trim();
  if (!unit) return metric.value;
  if (metric.value.includes(unit)) return metric.value;
  if (unit === "%") return `${metric.value}%`;
  if (unit === "$") return `$${metric.value}`;
  return `${metric.value} ${unit}`;
}

function readWatchlist(): WatchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(WATCH_KEY) ?? "[]");
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

function writeWatchlist(records: WatchRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCH_KEY, JSON.stringify(records));
}

function pctMove(first: number, last: number): number {
  if (Math.abs(first) < 0.000001) return last - first;
  return ((last - first) / Math.abs(first)) * 100;
}

function moveLabel(move: number | null): string {
  if (move == null || !Number.isFinite(move)) return "No recorded move";
  const sign = move > 0 ? "+" : "";
  return `${sign}${move.toFixed(Math.abs(move) >= 10 ? 1 : 2)}%`;
}

function moveMagnitude(move: number | null): number {
  return move == null || !Number.isFinite(move) ? -1 : Math.abs(move);
}

function askHref(metric: { label: string; value: string; unit?: string | null }): string {
  const question = `What does ${metric.label} at ${displayValue(metric)} mean for Australian property right now?`;
  return `/ask?q=${encodeURIComponent(question)}`;
}

export default function SignalsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const requestedMetricKey = params.get("metric");
  const requestedView = params.get("view") === "chart" ? "chart" : "number";
  const metrics = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const histories = trpc.metrics.histories.useQuery(undefined, { staleTime: 30 * 60_000 });
  const editions = trpc.editions.list.useQuery(undefined, { staleTime: 10 * 60_000 });
  const [watchlist, setWatchlist] = useState<WatchRecord[]>([]);

  useEffect(() => setWatchlist(readWatchlist()), []);

  const rows = useMemo(() => {
    return (metrics.data ?? []).map((metric) => {
      const series = histories.data?.[metric.metricKey] ?? [];
      const first = series[0]?.value;
      const last = series[series.length - 1]?.value;
      const move =
        typeof first === "number" && typeof last === "number" && series.length >= 2
          ? pctMove(first, last)
          : null;
      return { metric, series, move };
    });
  }, [metrics.data, histories.data]);

  const ranked = useMemo(
    () => [...rows].sort((a, b) => moveMagnitude(b.move) - moveMagnitude(a.move)),
    [rows]
  );
  const requestedHero = requestedMetricKey
    ? rows.find((row) => row.metric.metricKey === requestedMetricKey) ?? null
    : null;
  const hero = requestedHero ?? ranked.find((row) => row.move != null) ?? rows[0] ?? null;
  const latestEdition = editions.data?.[0] ?? null;
  const chartView = requestedView === "chart" && Boolean(requestedHero?.series.length && requestedHero.series.length >= 2);

  function toggleWatch(row: (typeof rows)[number]) {
    const exists = watchlist.some((watch) => watch.metricKey === row.metric.metricKey);
    const next = exists
      ? watchlist.filter((watch) => watch.metricKey !== row.metric.metricKey)
      : [
          ...watchlist,
          {
            metricKey: row.metric.metricKey,
            baseline: parseDisplayNumber(row.metric.value),
            baselineDisplay: displayValue(row.metric),
            startedAt: new Date().toISOString(),
          },
        ];
    setWatchlist(next);
    writeWatchlist(next);
    if (!exists) trackEvent("signal_watch", "signals");
  }

  const watchedRows = watchlist
    .map((watch) => ({ watch, row: rows.find((row) => row.metric.metricKey === watch.metricKey) }))
    .filter((entry): entry is { watch: WatchRecord; row: (typeof rows)[number] } => Boolean(entry.row));

  if (metrics.isLoading || histories.isLoading) return <SignalsSkeleton />;

  return (
    <div className={`${GUTTER_X} pb-8`}>
      <header className="rule-major pt-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="bs-label-accent">The Desk · Signals</p>
            <h1
              className="font-serif font-bold mt-3"
              style={{ fontSize: "clamp(46px, 7vw, 88px)", lineHeight: 0.92, letterSpacing: "-0.045em" }}
            >
              What is moving now.
            </h1>
            <p
              className="font-serif mt-5 max-w-[58ch] text-[var(--color-fg-muted)]"
              style={{ fontSize: "clamp(19px, 2vw, 26px)", lineHeight: 1.4 }}
            >
              Live market signals, the number worth carrying into the next conversation, and a
              simple watchboard for the indicators you care about.
            </p>
          </div>
          <div className="flex items-center gap-2 bs-label mt-2">
            <Radio className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />
            {rows.length} live metric{rows.length === 1 ? "" : "s"}
          </div>
        </div>
      </header>


      {requestedMetricKey && !requestedHero && rows.length > 0 && (
        <div className="rule-hair rule-hair-b py-3 mt-5 text-sm text-[var(--color-fg-muted)]">
          That shared signal is no longer live. Showing the strongest current move instead.
        </div>
      )}

      {hero && (
        <section className="grid lg:grid-cols-[minmax(0,1.35fr)_1px_minmax(280px,0.65fr)] mt-10">
          <div className="lg:pr-12 min-w-0">
            <p className="bs-label-accent">
              {requestedHero ? `Shared signal · ${chartView ? "The Chart" : "The Number"}` : "The Number"}
            </p>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mt-3">
              <p
                className="font-serif font-bold tabular-nums"
                style={{ fontSize: "clamp(64px, 11vw, 144px)", lineHeight: 0.78, letterSpacing: "-0.055em" }}
              >
                {displayValue(hero.metric)}
              </p>
              {hero.move != null && (
                <p className="font-mono text-[13px] pb-2 text-[var(--color-accent-text)]">
                  {moveLabel(hero.move)} across recorded history
                </p>
              )}
            </div>
            <h2 className="font-serif font-bold mt-7" style={{ fontSize: 34, lineHeight: 1.08 }}>
              {hero.metric.label}
            </h2>
            {hero.metric.context && (
              <p className="font-serif mt-3 max-w-[58ch] text-xl leading-8 text-[var(--color-fg-body)]">
                {hero.metric.context}
              </p>
            )}

            {chartView && (
              <SignalTrendFigure
                label={hero.metric.label}
                series={hero.series}
                move={hero.move}
              />
            )}

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <ShareSignalCardButton metricKey={hero.metric.metricKey} />
              {hero.series.length >= 2 && (
                <ShareMetricCardButton
                  metricKey={hero.metric.metricKey}
                  label={hero.metric.label}
                  canChart
                />
              )}
              <WatchButton
                watched={watchlist.some((watch) => watch.metricKey === hero.metric.metricKey)}
                onClick={() => toggleWatch(hero)}
              />
              <Link href={askHref(hero.metric)} className="bs-btn bs-btn-outline">
                Ask what it means
              </Link>
              {requestedHero && hero.series.length >= 2 && (
                <Link
                  href={`/signals?metric=${encodeURIComponent(hero.metric.metricKey)}${chartView ? "" : "&view=chart"}`}
                  className="bs-btn bs-btn-outline inline-flex items-center gap-2"
                >
                  <LineChart className="h-3.5 w-3.5" />
                  {chartView ? "The Number" : "Open The Chart"}
                </Link>
              )}
            </div>
          </div>

          <div className="hidden lg:block bg-[var(--color-border)]" aria-hidden="true" />

          <aside className="lg:pl-9 mt-10 lg:mt-0">
            <p className="bs-label-accent">The Desk Take</p>
            {latestEdition?.rubensTake ? (
              <>
                <p className="font-serif mt-3 text-2xl leading-9 text-[var(--color-fg-body)]">
                  {latestEdition.rubensTake}
                </p>
                <Link
                  href={`/editions/${latestEdition.editionNumber}`}
                  className="bs-label bs-link mt-5 inline-block"
                >
                  Edition {latestEdition.editionNumber} →
                </Link>
              </>
            ) : (
              <p className="mt-3 text-[var(--color-fg-muted)]">
                The latest editorial take will appear here with the next published edition.
              </p>
            )}
          </aside>
        </section>
      )}

      <section className="rule-major mt-11 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="bs-label-accent">In motion</p>
            <h2 className="font-serif font-bold mt-2" style={{ fontSize: 38, lineHeight: 1 }}>
              The live board
            </h2>
          </div>
          <Link href="/trends" className="bs-label bs-link">
            Full 30-day charts →
          </Link>
        </div>

        <div className="mt-5 rule-hair-b">
          {ranked.slice(0, 8).map((row) => {
            const watched = watchlist.some((watch) => watch.metricKey === row.metric.metricKey);
            const rising = (row.move ?? 0) >= 0;
            const MoveIcon = rising ? MoveUpRight : MoveDownRight;
            return (
              <div
                key={row.metric.metricKey}
                className="rule-hair py-4 grid sm:grid-cols-[minmax(0,1fr)_140px_120px_auto] gap-3 sm:gap-5 items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/signals?metric=${encodeURIComponent(row.metric.metricKey)}`}
                    className="font-serif text-xl leading-6 bs-link"
                  >
                    {row.metric.label}
                  </Link>
                  <p className="bs-label mt-1.5 truncate">
                    {row.metric.groupKey ?? "Market"}
                    {row.metric.source ? ` · ${row.metric.source}` : ""}
                  </p>
                </div>
                <p className="font-serif font-bold tabular-nums text-2xl sm:text-right">
                  {displayValue(row.metric)}
                </p>
                <div className="flex sm:justify-end items-center gap-1.5 font-mono text-xs text-[var(--color-fg-muted)]">
                  {row.move != null && <MoveIcon className="h-3.5 w-3.5" />}
                  {moveLabel(row.move)}
                </div>
                <WatchButton watched={watched} compact onClick={() => toggleWatch(row)} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rule-major mt-11 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="bs-label-accent">Watchboard</p>
            <h2 className="font-serif font-bold mt-2" style={{ fontSize: 38, lineHeight: 1 }}>
              Your watched signals
            </h2>
          </div>
          <p className="bs-label">Stored on this device · {watchedRows.length} watching</p>
        </div>

        {watchedRows.length === 0 ? (
          <div className="rule-hair rule-hair-b mt-5 py-9">
            <p className="font-serif text-2xl">Nothing on watch yet.</p>
            <p className="mt-2 text-[var(--color-fg-muted)] max-w-[58ch]">
              Watch any live metric above. The Desk will remember the value from the moment you
              started watching so you can see what changed next time you return.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 mt-5">
            {watchedRows.map(({ watch, row }, index) => {
              const current = parseDisplayNumber(row.metric.value);
              const sinceWatch =
                watch.baseline != null && current != null ? pctMove(watch.baseline, current) : null;
              return (
                <div
                  key={watch.metricKey}
                  className={`${index > 0 ? "lg:rule-hair-l lg:pl-7" : ""} ${index < watchedRows.length - 1 ? "lg:pr-7" : ""} py-5`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="bs-label-accent">Watching</p>
                    <button
                      type="button"
                      onClick={() => toggleWatch(row)}
                      className="bs-label bs-link"
                    >
                      Remove
                    </button>
                  </div>
                  <Link
                    href={`/signals?metric=${encodeURIComponent(row.metric.metricKey)}`}
                    className="font-serif text-2xl mt-3 bs-link block"
                  >
                    {row.metric.label}
                  </Link>
                  <p className="font-serif font-bold tabular-nums mt-2" style={{ fontSize: 42, lineHeight: 1 }}>
                    {displayValue(row.metric)}
                  </p>
                  <p className="font-mono text-xs mt-3 text-[var(--color-fg-muted)]">
                    Started {new Date(watch.startedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    {sinceWatch != null ? ` · ${moveLabel(sinceWatch)} since watch` : ""}
                  </p>
                  <p className="text-sm mt-2 text-[var(--color-fg-muted)]">
                    Baseline {watch.baselineDisplay}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <NswPlanningPanel />
    </div>
  );
}

function SignalTrendFigure({
  label,
  series,
  move,
}: {
  label: string;
  series: Array<{ value: number; recordedAt: Date }>;
  move: number | null;
}) {
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.abs(max) * 0.01, 1e-9);
  const width = 900;
  const height = 220;
  const pad = 8;
  const points = values
    .map((value, index) => {
      const x = pad + (values.length === 1 ? (width - pad * 2) / 2 : (index / (values.length - 1)) * (width - pad * 2));
      const y = pad + (1 - (value - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const firstDate = series[0]?.recordedAt
    ? new Date(series[0].recordedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
    : "Start";
  const lastDate = series[series.length - 1]?.recordedAt
    ? new Date(series[series.length - 1]!.recordedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
    : "Now";

  return (
    <figure className="rule-hair rule-hair-b mt-7 py-5" aria-label={`${label}, recorded trend`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="bs-label-accent">The Chart · 30-day direction</p>
        <p className="bs-label">{moveLabel(move)} · {series.length} points</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`${label} trend line`}>
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="var(--color-border)"
          strokeWidth="2"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-accent-text)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between bs-label mt-2">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </figcaption>
    </figure>
  );
}

function WatchButton({
  watched,
  onClick,
  compact = false,
}: {
  watched: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = watched ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={watched}
      className={`${compact ? "bs-label bs-link" : "bs-btn bs-btn-outline"} inline-flex items-center gap-2 justify-center`}
    >
      <Icon className="h-3.5 w-3.5" />
      {watched ? "Watching" : "Watch"}
    </button>
  );
}

function SignalsSkeleton() {
  return (
    <div className={`${GUTTER_X} pb-8`} aria-busy="true">
      <div className="rule-major pt-5 space-y-4 max-w-4xl">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
      <div className="grid lg:grid-cols-3 gap-7 mt-10">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-72 mt-10" />
    </div>
  );
}
