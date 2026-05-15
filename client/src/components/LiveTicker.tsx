/**
 * Newsroom-style ticker. Pulls the latest edition's `signals` array and
 * scrolls them across the top of the viewport in a thin amber strip,
 * paused on hover.
 *
 * Sits below the demo-mode banner (if any) and above the editorial-rule
 * top-line. Disappears when there's nothing to show.
 */
import { Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";

const SEPARATOR = "  ·  ";

export function LiveTicker() {
  const editionsQuery = trpc.editions.list.useQuery();
  const latest = editionsQuery.data?.[0];
  const signals = (latest?.signals ?? []).filter(Boolean);
  if (signals.length === 0) return null;

  // Render the signal list twice so the scroll loops seamlessly via the
  // ticker-track keyframe in index.css.
  const joined = signals.join(SEPARATOR);

  return (
    <div
      className="relative overflow-hidden border-b border-[var(--color-border)] bg-[oklch(0.10_0.018_260)] group"
      style={{ height: "30px" }}
      aria-label="Live intelligence ticker"
    >
      <div className="absolute inset-y-0 left-0 z-20 flex items-center gap-2 px-4 bg-[oklch(0.10_0.018_260)] border-r border-[var(--color-border)] shrink-0">
        <span className="live-dot" aria-hidden="true" />
        <span className="overline-amber" style={{ letterSpacing: "0.18em" }}>
          Live
        </span>
      </div>

      <div
        className="absolute inset-y-0 left-[110px] right-0 overflow-hidden flex items-center"
        style={{ maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)" }}
      >
        <div
          className="ticker-track inline-flex items-center whitespace-nowrap text-sm font-serif italic text-[var(--color-fg-muted)] group-hover:[animation-play-state:paused]"
          style={{ willChange: "transform" }}
        >
          {/* Loop twice for seamless wrap. */}
          <span className="pr-12">{joined}{SEPARATOR}</span>
          <span className="pr-12" aria-hidden="true">
            {joined}{SEPARATOR}
          </span>
        </div>
      </div>

      <Radio className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/60" aria-hidden="true" />
    </div>
  );
}
