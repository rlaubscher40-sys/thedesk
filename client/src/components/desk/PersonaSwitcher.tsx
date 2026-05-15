/**
 * "VIEW AS" segmented control. Updates the global persona, which the cards
 * read to highlight the matching Partner Angle / Say This row and tint
 * their left-edge accent.
 */
import { PERSONAS } from "@/data/editions/2026-05-15";
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR, usePersona } from "@/lib/persona";

export function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="overline text-[var(--color-fg-subtle)]"
        style={{ letterSpacing: "0.22em" }}
      >
        View as
      </span>
      <div
        role="radiogroup"
        aria-label="Active partner persona"
        className="flex gap-1.5 flex-wrap p-1 rounded panel"
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
                "relative px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all duration-200",
                active
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              )}
              style={
                active
                  ? {
                      background: `${colour}15`,
                      boxShadow: `inset 0 0 0 1px ${colour}55`,
                    }
                  : {}
              }
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full mr-2 align-middle"
                style={{ background: colour, opacity: active ? 1 : 0.5 }}
                aria-hidden="true"
              />
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
