/**
 * Full-width metrics strip on the Today page. Sits at the top of the
 * editorial body — under the hero + controls. Each tile carries a
 * direction-of-good trend arrow + delta against the prior edition,
 * coloured green/red/amber by sentiment.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { editionMeta, metrics } from "@/data/editions/2026-05-15";
import { resolveMetricTrend } from "@/lib/metrics";

export function MetricsStrip() {
  return (
    <section
      className="panel rounded-sm overflow-hidden"
      aria-label="Today's key metrics versus prior edition"
    >
      <header className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.24em" }}
        >
          Key metrics · versus prior edition
        </p>
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          Edition {editionMeta.number} · {editionMeta.date}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, idx) => {
          const { hasDelta, delta, trend, sentiment, colour } = resolveMetricTrend(
            m.key,
            m.value,
            m.prior
          );
          const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
          return (
            <div
              key={m.key}
              className={
                "p-6 lg:p-7 border-t border-[var(--color-border)] " +
                "first:border-t-0 lg:border-t-0 " +
                "lg:border-l first:border-l-0 border-[var(--color-border)] " +
                (idx === 1 ? "lg:border-l border-l border-[var(--color-border)]" : "")
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
                <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
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
