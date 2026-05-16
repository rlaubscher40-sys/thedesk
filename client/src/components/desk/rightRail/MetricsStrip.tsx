/**
 * Full-width metrics strip on the Today page. Sits at the top of the
 * editorial body — under the hero + controls. Each tile carries a
 * direction-of-good trend arrow + delta against the previous day's
 * value, coloured green/red/amber by sentiment.
 *
 * Reads from `trpc.metrics.list` (DB-backed, refreshed daily by the
 * daily-metrics GitHub Actions workflow). Falls back to the curated
 * seed metrics when the DB has nothing yet (dev / first boot).
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { editionMeta, metrics as seedMetrics } from "@/data/editions/2026-05-15";
import { resolveMetricTrend } from "@/lib/metrics";
import { trpc } from "@/lib/trpc";

type Tile = {
  key: string;
  value: string;
  prior: string | null;
  detail?: string | null;
};

export function MetricsStrip() {
  const { data: liveMetrics } = trpc.metrics.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // Live tiles come from the DB. Each row has value + previousValue, which
  // resolveMetricTrend uses to compute the arrow and delta.
  const liveTiles: Tile[] =
    liveMetrics?.map((m) => ({
      key: m.label,
      value: m.unit === "%" ? `${m.value}${m.unit}` : m.value,
      prior: m.previousValue
        ? m.unit === "%"
          ? `${m.previousValue}${m.unit}`
          : m.previousValue
        : null,
      detail: m.source ? `as of ${formatAsOf(m.asOf)} · ${m.source}` : undefined,
    })) ?? [];

  const tiles: Tile[] =
    liveTiles.length > 0
      ? liveTiles
      : seedMetrics.map((m) => ({
          key: m.key,
          value: m.value,
          prior: m.prior ?? null,
          detail: m.detail ?? null,
        }));

  const headerRight =
    liveTiles.length > 0
      ? `Live · refreshed daily`
      : `Edition ${editionMeta.number} · ${editionMeta.date}`;

  return (
    <section
      className="panel rounded-sm overflow-hidden"
      aria-label="Today's key metrics versus prior day"
    >
      <header className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.24em" }}
        >
          Key metrics · versus prior
        </p>
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          {headerRight}
        </p>
      </header>

      <div
        className={
          "grid grid-cols-2 " +
          (tiles.length <= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-6")
        }
      >
        {tiles.map((m, idx) => {
          const { hasDelta, delta, trend, sentiment, colour } = resolveMetricTrend(
            m.key,
            m.value,
            m.prior
          );
          const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
          return (
            <div
              key={m.key + idx}
              className={
                "p-6 lg:p-7 border-t border-[var(--color-border)] " +
                "first:border-t-0 lg:border-t-0 " +
                "lg:border-l first:border-l-0 border-[var(--color-border)]"
              }
            >
              <p
                className="overline mb-3 truncate"
                style={{ letterSpacing: "0.18em", fontSize: "10px" }}
                title={m.key}
              >
                {m.key}
              </p>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p className="font-serif text-3xl lg:text-4xl font-bold tabular-nums text-[var(--color-fg)] leading-none">
                  {m.value}
                </p>
                <span
                  className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0"
                  style={{ color: colour, fontSize: "11px" }}
                  title={`${trend} vs prior · ${sentiment}`}
                  aria-label={`${trend} versus prior — ${sentiment}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {hasDelta && trend !== "flat" && (
                    <span>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(Math.abs(delta) < 1 ? 3 : 2)}
                    </span>
                  )}
                </span>
              </div>
              {m.detail && (
                <p className="font-mono text-[11px] text-[var(--color-fg-subtle)] truncate" title={m.detail}>
                  {m.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatAsOf(asOf: Date | string): string {
  const d = asOf instanceof Date ? asOf : new Date(asOf);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
