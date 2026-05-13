/**
 * Renders the `signals` array on an edition — short one-line briefs that
 * sit below the main topic deck. Editorial treatment: big mono numerals
 * in amber, signal text in serif.
 */
export function SignalsBriefs({ signals }: { signals: string[] }) {
  const filtered = signals.filter((s) => s && s.trim().length > 0);
  if (filtered.length === 0) return null;
  return (
    <section className="my-14">
      <div className="flex items-center gap-3 mb-6">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Other signals
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
      <ol className="space-y-4">
        {filtered.map((signal, idx) => (
          // Defensive index suffix (issue #1) — signal text usually unique.
          <li
            key={`signal-${idx}-${signal.slice(0, 24)}`}
            className="flex gap-5 items-baseline"
          >
            <span
              className="font-mono shrink-0 text-amber-400/80 tabular-nums"
              style={{ fontSize: "20px", fontWeight: 500 }}
            >
              {String(idx + 1).padStart(2, "0")}
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
