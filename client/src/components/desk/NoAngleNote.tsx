/**
 * Quiet inline note that sits where a SAY THIS block would, when the
 * current persona has no angle on this story. Used for trending /
 * broadly-cultural items that don't deserve a forced talking point.
 */
import type { Persona } from "@/data/editions/2026-05-15";

export function NoAngleNote({ persona }: { persona: Persona }) {
  return (
    <div
      className="mt-7 p-4 rounded-sm text-xs text-[var(--color-fg-subtle)] font-mono uppercase tracking-[0.18em] flex items-center gap-2"
      style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
    >
      <span
        className="h-1 w-6 rounded-full"
        style={{ background: "var(--color-border-strong)" }}
        aria-hidden="true"
      />
      Not relevant to {persona} this week
    </div>
  );
}
