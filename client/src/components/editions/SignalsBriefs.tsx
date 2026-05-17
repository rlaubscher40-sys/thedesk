/**
 * Renders the `signals` array on an edition below the topic deck.
 * Editorial treatment: big mono numerals in amber, signal text in serif.
 *
 * The first six signals are shown as the "In brief" scan strip next to
 * Ruben's Take at the top of the hero, so this component skips them and
 * shows the rest as "More signals". If there are six or fewer signals
 * total, this section renders nothing to avoid duplication.
 */
const SHOWN_AT_TOP = 6;

export function SignalsBriefs({ signals }: { signals: string[] }) {
  const filtered = signals.filter((s) => s && s.trim().length > 0);
  // Drop the first six — they appear in the hero scan strip. If there's
  // nothing left after that, render nothing.
  const remaining = filtered.slice(SHOWN_AT_TOP);
  if (remaining.length === 0) return null;
  return (
    <section className="my-14">
      <div className="flex items-center gap-3 mb-6">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          More signals
        </p>
        <span
          className="block flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
          }}
          aria-hidden="true"
        />
      </div>
      <ol className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
        {remaining.map((signal, idx) => (
          // Numbering continues from where the hero scan strip left off
          // so readers can correlate "signal #7 above the fold"-style
          // references. Defensive index suffix on the key (issue #1) —
          // signal text usually unique.
          <li
            key={`signal-${idx}-${signal.slice(0, 24)}`}
            className="flex gap-5 items-baseline"
          >
            <span
              className="font-mono shrink-0 text-amber-400/80 tabular-nums"
              style={{ fontSize: "22px", fontWeight: 500 }}
            >
              {String(idx + 1 + SHOWN_AT_TOP).padStart(2, "0")}
            </span>
            <span className="font-serif text-lg text-[var(--color-fg)] leading-snug">
              {signal}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
