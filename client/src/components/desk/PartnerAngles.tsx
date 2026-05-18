/**
 * Renders the four Partner Angles on a card. The row matching the active
 * persona is highlighted; the others dim to 40% opacity. Clicking a
 * dimmed row promotes that persona globally, same as the VIEW AS pills.
 */
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR, usePersona } from "@/lib/persona";
import type { PartnerAngle } from "@/data/editions/2026-05-15";

export function PartnerAngles({ angles }: { angles: PartnerAngle[] }) {
  const { persona, setPersona } = usePersona();
  return (
    <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
      <p className="overline mb-3" style={{ letterSpacing: "0.2em" }}>
        Partner angles
      </p>
      <div className="space-y-1.5">
        {angles.map((a) => {
          const active = a.persona === persona;
          const colour = PERSONA_COLOUR[a.persona];
          return (
            <button
              key={a.persona}
              type="button"
              onClick={() => setPersona(a.persona)}
              className={cn(
                "block w-full text-left text-sm leading-relaxed rounded py-1.5 px-2 -mx-2 transition-all",
                active
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-80 hover:bg-white/[0.03]"
              )}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.16em] mr-3 inline-block w-[110px] align-middle"
                style={{ color: colour }}
              >
                {a.persona}
              </span>
              <span className="text-[var(--color-fg-muted)] align-middle">{a.angle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
