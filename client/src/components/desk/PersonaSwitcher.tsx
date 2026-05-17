/**
 * "VIEW AS" segmented control. Updates the global persona, which the cards
 * read to highlight the matching Partner Angle / Say This row and tint
 * their left-edge accent.
 *
 * First-time visitors see a one-line caption explaining what switching
 * actually does, since the chips alone don't make it obvious that the
 * page content tailors itself.
 */
import { useEffect, useState } from "react";
import { PERSONAS } from "@/data/editions/2026-05-15";
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR, usePersona } from "@/lib/persona";

const CAPTION_STORAGE_KEY = "thedesk:persona-caption-seen";

export function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();
  const [showCaption, setShowCaption] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(CAPTION_STORAGE_KEY) === "1") return;
    setShowCaption(true);
  }, []);

  function handleSetPersona(p: typeof persona) {
    setPersona(p);
    if (showCaption) {
      window.localStorage.setItem(CAPTION_STORAGE_KEY, "1");
      setShowCaption(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
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
        className="flex gap-1 flex-wrap p-1 rounded border border-[var(--color-border)] bg-[var(--color-panel-tile-bg)]"
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
              onClick={() => handleSetPersona(p)}
              className={cn(
                "relative px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-[0.14em] transition-all duration-200",
                active
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
              )}
              style={
                active
                  ? {
                      background: `${colour}13`,
                      boxShadow: `inset 0 0 0 1px ${colour}55`,
                    }
                  : {}
              }
            >
              <span
                className="inline-block h-1 w-1 rounded-full mr-2 align-middle transition-opacity"
                style={{ background: colour, opacity: active ? 1 : 0.4 }}
                aria-hidden="true"
              />
              {p}
            </button>
          );
        })}
      </div>
      </div>
      {showCaption && (
        <p
          className="text-[11px] text-[var(--color-fg-subtle)] leading-snug pl-1 max-w-[60ch]"
          style={{ animation: "fade-in 0.35s ease-out" }}
        >
          Tailors the "Say This" angle on each story to your audience.
        </p>
      )}
    </div>
  );
}
