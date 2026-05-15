/**
 * Full-width metrics strip. Sits at the top of the editorial body — under
 * the hero + controls, above the feed — instead of as a tile in the right
 * rail. Four tiles laid out as a single horizontal band that owns the
 * page's full inner width.
 *
 * Each tile: uppercase mono key, oversized Playfair value, small mono
 * detail line. The right-most edge of the strip carries the edition
 * stamp.
 */
import { editionMeta, metrics } from "@/data/editions/2026-05-15";

export function MetricsStrip() {
  return (
    <section
      className="panel rounded-sm overflow-hidden"
      aria-label="Today's key metrics"
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
        {metrics.map((m, idx) => (
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
            <p className="font-serif text-3xl lg:text-4xl font-bold tabular-nums text-[var(--color-fg)] leading-none">
              {m.value}
            </p>
            {m.detail && (
              <p className="font-mono text-[11px] text-[var(--color-fg-subtle)] mt-2">
                {m.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
