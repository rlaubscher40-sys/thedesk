/**
 * Renders the `signals` array on an edition — short one-line briefs that
 * sit below the main topic deck.
 */
export function SignalsBriefs({ signals }: { signals: string[] }) {
  const filtered = signals.filter((s) => s && s.trim().length > 0);
  if (filtered.length === 0) return null;
  return (
    <section className="my-10">
      <p className="overline mb-3">Other signals</p>
      <ul className="space-y-2.5">
        {filtered.map((signal, idx) => (
          // Defensive index suffix (issue #1) — signal text usually unique.
          <li key={`signal-${idx}-${signal.slice(0, 24)}`} className="flex gap-3 text-sm">
            <span className="font-mono text-amber-400/70 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <span className="text-[var(--color-fg-muted)] leading-relaxed">{signal}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
