/**
 * Top scrolling ticker. Pulls from `tickerItems` in the edition data file
 * so the strip is editable without touching JSX. Renders the list twice
 * for seamless wrap-around (CSS keyframe translates by 50%).
 *
 *   ● LIVE  · Item · Item · Item · …
 *
 * Paused on hover. Disappears if the array is empty.
 */
import { categoryColour } from "@/lib/category";
import { tickerItems } from "@/data/editions/2026-05-15";

export function LiveTicker() {
  if (tickerItems.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden border-b border-[var(--color-border)] bg-[oklch(0.10_0.018_260)] group"
      style={{ height: "30px" }}
      aria-label="Live intelligence ticker"
    >
      {/* Fixed left LIVE badge. */}
      <div className="absolute inset-y-0 left-0 z-20 flex items-center gap-2 px-4 bg-[oklch(0.10_0.018_260)] border-r border-[var(--color-border)] shrink-0">
        <span className="live-dot" aria-hidden="true" />
        <span className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Live
        </span>
      </div>

      {/* Scrolling track. */}
      <div
        className="absolute inset-y-0 left-[100px] right-0 overflow-hidden flex items-center"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 4%, black 96%, transparent)",
        }}
      >
        <div
          className="ticker-track inline-flex items-center whitespace-nowrap text-sm font-serif italic text-[var(--color-fg-muted)] group-hover:[animation-play-state:paused]"
          style={{ willChange: "transform" }}
        >
          {[0, 1].map((loop) => (
            <span key={loop} className="inline-flex items-center">
              {tickerItems.map((item, i) => (
                <span key={`${loop}-${i}`} className="inline-flex items-center pr-6">
                  {item.category && (
                    <span
                      className="font-mono uppercase tracking-[0.18em] mr-2.5"
                      style={{
                        color: categoryColour(item.category),
                        fontSize: "9px",
                      }}
                    >
                      {item.category}
                    </span>
                  )}
                  <span>{item.label}</span>
                  <span className="text-[var(--color-fg-subtle)] mx-3" aria-hidden="true">
                    ·
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
