/**
 * Front-page strip at the top of the Trends page. Three blocks side by
 * side: the biggest 7-day movers (computed from daily_metric_history),
 * the current market-stress signal (from the latest edition's
 * marketStress field), and the next forward-looking dates (from the
 * latest edition's datesToWatch).
 *
 * Turns the page from "a wall of charts" into a punchy editorial lede.
 */
import { ArrowDown, ArrowUp, CalendarDays, Gauge, Minus } from "lucide-react";
import type { DailyMetric } from "@shared/types";

/**
 * The subset of Edition fields this hero reads. Typed locally so it
 * accepts both the full Edition and the leaner EditionSummary returned
 * by editions.list — neither needs topics/body/signals/fullText here.
 */
type EditionLite = {
  editionNumber: number;
  marketStress: string | null;
  datesToWatch: Array<{ label: string; description: string }> | null;
};
import { Sparkline } from "@/components/charts/Sparkline";
import { Skeleton } from "@/components/ui/Skeleton";

type Histories = Record<string, Array<{ value: number; recordedAt: Date }>>;

type Mover = {
  metricKey: string;
  label: string;
  unit: string | null;
  value: string;
  history: number[];
  /** Absolute change over the lookback window. */
  delta: number;
  /** Signed percentage change (current / earliest - 1) * 100. */
  pctChange: number;
};

/**
 * Pick the top three metrics by absolute percent change over the last
 * `lookbackDays` of history. Metrics with too little history are skipped.
 */
function pickMovers(
  metrics: DailyMetric[],
  histories: Histories,
  lookbackDays = 7,
  limit = 3
): Mover[] {
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  const candidates: Mover[] = [];
  for (const m of metrics) {
    const series = histories[m.metricKey] ?? [];
    if (series.length < 2) continue;
    // Find the earliest point within the lookback window.
    const recent = series.filter(
      (p) => new Date(p.recordedAt).getTime() >= cutoff
    );
    if (recent.length < 2) continue;
    const earliest = recent[0]!.value;
    const latest = recent[recent.length - 1]!.value;
    if (earliest === 0) continue;
    const pctChange = ((latest - earliest) / Math.abs(earliest)) * 100;
    candidates.push({
      metricKey: m.metricKey,
      label: m.label,
      unit: m.unit,
      value: m.value,
      history: recent.map((p) => p.value),
      delta: latest - earliest,
      pctChange,
    });
  }
  candidates.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  return candidates.slice(0, limit);
}

export function ThisWeekInMotion({
  metrics,
  histories,
  editions,
  loading,
}: {
  metrics: DailyMetric[] | undefined;
  histories: Histories | undefined;
  editions: EditionLite[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-px panel rounded overflow-hidden mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[var(--color-bg-elevated)] p-6">
            <Skeleton className="h-3 w-24 mb-4" />
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const movers =
    metrics && histories ? pickMovers(metrics, histories) : [];
  const latestEdition = editions?.[0]; // editions.list returns newest-first
  const stress = latestEdition?.marketStress ?? null;
  const dates = (latestEdition?.datesToWatch ?? []).slice(0, 4);

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-px panel rounded overflow-hidden mb-8"
      aria-label="This week in motion"
    >
      <MoversBlock movers={movers} />
      <StressBlock stress={stress} edition={latestEdition} />
      <DatesBlock dates={dates} edition={latestEdition} />
    </section>
  );
}

function MoversBlock({ movers }: { movers: Mover[] }) {
  return (
    <div className="bg-[var(--color-bg-elevated)] p-5 sm:p-6">
      <p
        className="overline-amber mb-4"
        style={{ letterSpacing: "0.22em", fontSize: "10px" }}
      >
        In motion · 7 days
      </p>
      {movers.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Sparkline history will populate as the daily ingest runs.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {movers.map((m) => (
            <MoverRow key={m.metricKey} mover={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MoverRow({ mover }: { mover: Mover }) {
  const direction: "up" | "down" | "flat" =
    Math.abs(mover.pctChange) < 0.05
      ? "flat"
      : mover.pctChange > 0
        ? "up"
        : "down";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const tone =
    direction === "up"
      ? "oklch(0.72 0.17 155)"
      : direction === "down"
        ? "oklch(0.68 0.20 15)"
        : "oklch(0.78 0.18 70)";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" title={mover.label}>
          {mover.label}
        </p>
        <p className="font-mono text-[11px] text-[var(--color-fg-subtle)] tabular-nums mt-0.5">
          {mover.value}
          {mover.unit ?? ""}
        </p>
      </div>
      <Sparkline values={mover.history} width={72} height={22} colour={tone} />
      <span
        className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0"
        style={{ color: tone, fontSize: "11px" }}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {mover.pctChange > 0 ? "+" : ""}
        {mover.pctChange.toFixed(Math.abs(mover.pctChange) < 1 ? 2 : 1)}%
      </span>
    </li>
  );
}

function StressBlock({
  stress,
  edition,
}: {
  stress: string | null;
  edition: EditionLite | undefined;
}) {
  const meta = stressMeta(stress);
  return (
    <div className="bg-[var(--color-bg-elevated)] p-5 sm:p-6">
      <p
        className="overline-amber mb-4 flex items-center gap-1.5"
        style={{ letterSpacing: "0.22em", fontSize: "10px" }}
      >
        <Gauge className="h-3 w-3" />
        Market stress
      </p>
      <div className="flex items-baseline gap-3 mb-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: meta.colour, boxShadow: `0 0 12px ${meta.colour}` }}
          aria-hidden="true"
        />
        <p
          className="font-serif text-2xl sm:text-3xl font-bold leading-none"
          style={{ color: meta.colour }}
        >
          {meta.label}
        </p>
      </div>
      <p className="text-[12.5px] text-[var(--color-fg-muted)] leading-relaxed">
        {meta.description}
      </p>
      {edition && (
        <p
          className="overline mt-4 text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          per Edition {edition.editionNumber}
        </p>
      )}
    </div>
  );
}

function stressMeta(stress: string | null): {
  label: string;
  colour: string;
  description: string;
} {
  switch (stress) {
    case "high":
      return {
        label: "HIGH",
        colour: "oklch(0.68 0.20 15)",
        description:
          "Editorial read: stress / dislocation across rates, listings or lending. Lean defensive in client conversations.",
      };
    case "moderate":
      return {
        label: "MODERATE",
        colour: "oklch(0.78 0.18 70)",
        description:
          "Editorial read: mixed signals. Some metrics repairing, others wobbling. Hold ground; reassure but don't reposition.",
      };
    case "low":
      return {
        label: "LOW",
        colour: "oklch(0.72 0.17 155)",
        description:
          "Editorial read: stable or repairing. Good week to push on growth conversations rather than risk.",
      };
    default:
      return {
        label: "—",
        colour: "oklch(0.55 0.02 260)",
        description:
          "No market-stress signal in the latest edition yet. Will populate after the next Sunday synthesis.",
      };
  }
}

function DatesBlock({
  dates,
  edition,
}: {
  dates: Array<{ label: string; description: string }>;
  edition: EditionLite | undefined;
}) {
  return (
    <div className="bg-[var(--color-bg-elevated)] p-5 sm:p-6">
      <p
        className="overline-amber mb-4 flex items-center gap-1.5"
        style={{ letterSpacing: "0.22em", fontSize: "10px" }}
      >
        <CalendarDays className="h-3 w-3" />
        Dates to watch
      </p>
      {dates.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Forward calendar fills out once the next weekly edition lands.
        </p>
      ) : (
        <ul className="space-y-3">
          {dates.map((d, i) => (
            <li key={`${d.label}-${i}`} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3">
              <span
                className="font-mono uppercase tabular-nums text-amber-300"
                style={{ fontSize: "11px", letterSpacing: "0.14em" }}
              >
                {d.label}
              </span>
              <p className="text-[12.5px] text-[var(--color-fg-muted)] leading-relaxed line-clamp-3">
                {d.description}
              </p>
            </li>
          ))}
        </ul>
      )}
      {edition && dates.length > 0 && (
        <p
          className="overline mt-4 text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          from Edition {edition.editionNumber}
        </p>
      )}
    </div>
  );
}
