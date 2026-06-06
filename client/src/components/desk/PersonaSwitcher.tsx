/**
 * "ANGLE FOR" segmented control. Picks who the active Say This line and
 * partner-angle row are written FOR — Broker, Adviser / Accountant, or
 * Buyer's Agent — not a viewpoint the reader adopts.
 *
 * The label was previously "View as", which implied role-play. The control
 * actually answers "who am I talking to?", so the new label + arrow reads
 * as a coherent sentence with the active chip on the right: "Angle for →
 * Broker". A persistent one-line hint sits beneath the row so the feature
 * doesn't go invisible after the first visit (the old one-time caption
 * disappeared after a single tap, leaving most days without any signal that
 * tapping a chip rewrites every story's Say This line).
 */
import { PERSONAS } from "@/data/editions/2026-05-15";
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR, personaDisplayLabel, usePersona } from "@/lib/persona";

export function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();
  const activeColour = PERSONA_COLOUR[persona];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="overline text-[var(--color-fg-subtle)] inline-flex items-center gap-1.5"
          style={{ letterSpacing: "0.22em" }}
        >
          Angle for
          <span aria-hidden="true" className="text-[var(--color-fg-subtle)]">
            →
          </span>
        </span>
        <div
          role="radiogroup"
          aria-label="Partner role this story's Say This line is angled for"
          className="flex gap-1 flex-wrap p-1 rounded border border-[var(--color-border-strong)] bg-[var(--color-panel-tile-bg)]"
        >
          {PERSONAS.map((p) => {
            const active = p === persona;
            const colour = PERSONA_COLOUR[p];
            return (
              <button
                key={p}
                role="radio"
                aria-checked={active}
                aria-pressed={active}
                onClick={() => setPersona(p)}
                className={cn(
                  "relative px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-[0.14em] transition-all duration-200",
                  active
                    ? "text-[var(--color-fg)] font-semibold"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
                style={
                  active
                    ? {
                        // ~2.5× the tint of the old "barely-there" 7.5%
                        // active state, plus a real coloured ring and soft
                        // glow so selection is unmistakable.
                        background: `${colour}33`,
                        boxShadow: `inset 0 0 0 1px ${colour}b3, 0 0 10px ${colour}4d`,
                      }
                    : {}
                }
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mr-2 align-middle transition-opacity"
                  style={{
                    background: colour,
                    opacity: active ? 1 : 0.45,
                    boxShadow: active ? `0 0 4px ${colour}` : "none",
                  }}
                  aria-hidden="true"
                />
                {personaDisplayLabel(p)}
              </button>
            );
          })}
        </div>
      </div>
      {/* Persistent inline hint. Was previously a one-time localStorage
          caption — left most days with no signal that tapping a chip rewrites
          every story's Say This line. Cheap to keep visible at this size. */}
      <p
        className="text-[11.5px] text-[var(--color-fg-muted)] leading-snug pl-1 max-w-[60ch] inline-flex items-center gap-2"
      >
        <span
          className="inline-block h-1 w-1 rounded-full shrink-0"
          style={{ background: activeColour }}
          aria-hidden="true"
        />
        Rewrites every story&apos;s{" "}
        <span className="font-medium text-[var(--color-fg)]">Say&nbsp;This</span> line for{" "}
        <span className="font-medium text-[var(--color-fg)]">
          {personaDisplayLabel(persona)}
        </span>
        .
      </p>
    </div>
  );
}
