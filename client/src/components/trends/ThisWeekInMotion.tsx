import { formatMetricValue, hasDailyObservations } from "@shared/metricPresentation";
/**
 * "In motion" — the Trends page lede, as three hairline-divided columns:
 * the biggest 7-day movers (computed from daily_metric_history), the
 * current market-stress signal, and the next forward-looking dates (both
 * from the latest edition).
 *
 * Restyled for the broadsheet: no panel, no radius, no gap-separated
 * tiles. The mover calculation and the stress copy are unchanged.
 */
import type { DailyMetric } from "@shared/types";
import { MetricSparkline } from "@/components/charts/BroadsheetCharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { cn } from "@/lib/cn";
import type { Sentiment } from "@/lib/metrics";

/**
 * The subset of Edition fields this lede reads. Typed locally so it
 * accepts both the full Edition and the leaner EditionSummary returned by
 * editions.list — neither needs topics/body/signals/fullText here.
 */
type EditionLite = {
  editionNumber: number;
  marketStress: string | null;
  datesToWatch: Array<{ label: string; description: string }> | null;
};

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
    if (!hasDailyObservations(m.metricKey)) continue;
    const series = histories[m.metricKey] ?? [];
    if (series.length < 2) continue;
    const recent = series.filter((p) => new Date(p.recordedAt).getTime() >= cutoff);
    if (recent.length < 2) continue;
    const earliest = recent[0]!.value;
    const latest = recent[recent.length - 1]!.value;
    if (earliest === 0) continue;
    const pctChange = ((latest - earliest) / Math.abs(earliest)) * 100;
    if (latest === earliest) continue;
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
      <div className={cn(GUTTER_X, "rule-major mt-8 pt-6 grid gap-8 lg:grid-cols-3")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const movers = metrics && histories ? pickMovers(metrics, histories) : [];
  const latestEdition = editions?.[0]; // editions.list returns newest-first
  const stress = latestEdition?.marketStress ?? null;
  const dates = (latestEdition?.datesToWatch ?? []).slice(0, 4);

  return (
    <section
      className={cn(
        GUTTER_X,
        "rule-major mt-8 pt-6 grid gap-y-9 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
      )}
      aria-label="In motion"
    >
      <div className="lg:pr-8 min-w-0">
        <MoversBlock movers={movers} />
      </div>
      <div className="lg:rule-hair-l lg:px-8 min-w-0">
        <StressBlock stress={stress} edition={latestEdition} />
      </div>
      <div className="lg:rule-hair-l lg:pl-8 min-w-0">
        <DatesBlock dates={dates} edition={latestEdition} />
      </div>
    </section>
  );
}

function MoversBlock({ movers }: { movers: Mover[] }) {
  return (
    <div>
      <p className="bs-label" style={{ letterSpacing: "0.22em" }}>
        Daily observations · last 7 days
      </p>
      {movers.length === 0 ? (
        <p className="mt-4 text-[var(--color-fg-muted)]" style={{ fontSize: "0.9375rem" }}>
          No changed daily observations in this stored window. Check the dated figures below.
        </p>
      ) : (
        <div className="mt-3">
          {movers.map((m, i) => (
            <MoverRow key={m.metricKey} mover={m} last={i === movers.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function MoverRow({ mover, last }: { mover: Mover; last: boolean }) {
  const direction: "up" | "down" | "flat" =
    Math.abs(mover.pctChange) < 0.05 ? "flat" : mover.pctChange > 0 ? "up" : "down";
  // "In motion" ranks by movement, not by whether the movement is welcome —
  // so the colour tracks direction rather than the metric's sentiment.
  const sentiment: Sentiment =
    direction === "up" ? "good" : direction === "down" ? "bad" : "neutral";

  return (
    <div
      className={cn(
        "rule-hair grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-4 py-3",
        last && "rule-hair-b"
      )}
    >
      <div className="min-w-0">
        <p className="break-words" style={{ fontSize: "0.9375rem" }} title={mover.label}>
          {mover.label}
        </p>
        <p className="bs-label mt-1 tabular-nums" style={{ letterSpacing: "0.1em" }}>
          {formatMetricValue(mover)}
        </p>
      </div>
      <MetricSparkline values={mover.history} sentiment={sentiment} height={22} />
      <span
        className="font-mono tabular-nums shrink-0"
        style={{ color: `var(--sentiment-${sentiment})`, fontSize: "0.75rem" }}
      >
        {direction === "up" ? "▲" : direction === "down" ? "▼" : "—"} {mover.delta > 0 ? "+" : ""}
        {mover.unit === "%"
          ? `${Number(mover.delta.toFixed(3))} pp`
          : `${mover.pctChange.toFixed(2)}%`}
      </span>
    </div>
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
    <div>
      <p className="bs-label" style={{ letterSpacing: "0.22em" }}>
        Market stress
      </p>
      <div className="flex items-baseline gap-3 mt-3">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: meta.colour }}
          aria-hidden="true"
        />
        <p
          className="font-serif font-bold"
          style={{ fontSize: "1.875rem", lineHeight: 1, color: meta.colour }}
        >
          {meta.label}
        </p>
      </div>
      <p
        className="mt-3 text-[var(--color-fg-muted)]"
        style={{ fontSize: "0.875rem", lineHeight: 1.55 }}
      >
        {meta.description}
      </p>
      {edition && (
        <p className="bs-label rule-hair mt-4 pt-3" style={{ letterSpacing: "0.18em" }}>
          Per Edition {edition.editionNumber}
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
        colour: "var(--sentiment-bad)",
        description:
          "Editorial read: stress / dislocation across rates, listings or lending. Lean defensive in client conversations.",
      };
    case "moderate":
      return {
        label: "MODERATE",
        colour: "var(--sentiment-neutral)",
        description:
          "Editorial read: mixed signals. Some metrics repairing, others wobbling. Hold ground; reassure but don't reposition.",
      };
    case "low":
      return {
        label: "LOW",
        colour: "var(--sentiment-good)",
        description:
          "Editorial read: stable or repairing. Good week to push on growth conversations rather than risk.",
      };
    default:
      return {
        label: "—",
        colour: "var(--color-fg-muted)",
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
    <div>
      <p className="bs-label" style={{ letterSpacing: "0.22em" }}>
        Dates to watch
      </p>
      {dates.length === 0 ? (
        <p className="mt-4 text-[var(--color-fg-muted)]" style={{ fontSize: "0.9375rem" }}>
          Forward calendar fills out once the next weekly edition lands.
        </p>
      ) : (
        <div className="mt-3">
          {dates.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className={cn(
                "rule-hair grid grid-cols-[68px_minmax(0,1fr)] gap-4 py-3",
                i === dates.length - 1 && "rule-hair-b"
              )}
            >
              <span
                className="font-mono uppercase tabular-nums"
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.14em",
                  color: "var(--color-accent-text)",
                }}
              >
                {d.label}
              </span>
              <p
                className="text-[var(--color-fg-muted)]"
                style={{ fontSize: "0.875rem", lineHeight: 1.5 }}
              >
                {d.description}
              </p>
            </div>
          ))}
        </div>
      )}
      {edition && dates.length > 0 && (
        <p className="bs-label mt-3" style={{ letterSpacing: "0.18em" }}>
          From Edition {edition.editionNumber}
        </p>
      )}
    </div>
  );
}
