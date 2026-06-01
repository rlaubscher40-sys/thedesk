/**
 * The one-line "Counterpoint": the calm contrarian read, the tension the
 * consensus glosses over. Sits near "Why it matters" but is visually
 * distinct, a cool slate accent rather than the category amber, so the
 * reader registers it as the other side of the story rather than more of
 * the same. Present only on stories with a genuine second side.
 */
const COUNTERPOINT_ACCENT = "oklch(0.70 0.06 250)"; // cool slate-blue

export function CounterpointLine({
  counterpoint,
  compact = false,
}: {
  counterpoint: string;
  /** Tighter spacing + smaller text for the signal strip. */
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "mt-2 flex items-start gap-2" : "mt-4 flex items-start gap-2.5"}
    >
      <span
        className="overline shrink-0 mt-1"
        style={{ color: COUNTERPOINT_ACCENT, letterSpacing: "0.2em" }}
      >
        Counterpoint
      </span>
      <p
        className={
          compact
            ? "font-serif italic text-[13px] leading-snug text-[var(--color-fg-muted)] flex-1 min-w-0"
            : "font-serif italic text-[15px] leading-relaxed text-[var(--color-fg-muted)] flex-1 min-w-0"
        }
      >
        {counterpoint}
      </p>
    </div>
  );
}
