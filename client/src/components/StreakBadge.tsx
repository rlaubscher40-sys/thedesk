/**
 * Sidebar reading-streak chip. Renders only when the streak ≥ 2 days
 * (a single visit isn't a streak yet). Tier-coloured: amber → emerald
 * → champagne as the streak grows. Tooltip surfaces the longest run.
 *
 * Bigger than v2, the count was reading as a forgettable secondary
 * stat. Now it's a small editorial moment: glowing flame, big serif
 * number, tier label below in mono, longest-run accent if relevant.
 * Fills the available sidebar width.
 */
import { Flame } from "lucide-react";
import { useStreak, type StreakTier } from "@/lib/useStreak";
import { cn } from "@/lib/cn";

// Tier accents drawn from existing brand tokens rather than inlined
// oklch literals: amber for the early tiers (it's the brand accent),
// property-green at the fortnight milestone, amber-bright at the
// monthly peak. Keeping these as token references means light-mode
// shifts the hues automatically per index.css §3.2.
const TIER_STYLE: Record<StreakTier, { colour: string; label: string }> = {
  none: { colour: "var(--color-fg-subtle)", label: "" },
  starter: { colour: "var(--color-amber)", label: "On a run" },
  weekly: { colour: "var(--color-amber-bright)", label: "Weekly habit" },
  fortnight: { colour: "var(--color-property)", label: "Two weeks running" },
  monthly: { colour: "var(--color-amber-bright)", label: "Monthly streak" },
};

export function StreakBadge({ collapsed }: { collapsed?: boolean }) {
  const { current, longest, tier } = useStreak();
  if (current < 2) return null;
  const style = TIER_STYLE[tier];

  if (collapsed) {
    return (
      <div
        className="mx-1.5 mt-3 mb-1 rounded-sm flex items-center justify-center py-2.5"
        style={{
          background: `${style.colour}18`,
          boxShadow: `inset 0 0 0 1px ${style.colour}55`,
        }}
        title={`Current streak: ${current} day${current === 1 ? "" : "s"}. Longest: ${longest} day${longest === 1 ? "" : "s"}.`}
      >
        <Flame
          className="h-4 w-4"
          style={{ color: style.colour }}
          strokeWidth={2}
          fill={style.colour}
          fillOpacity={0.3}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-3 mt-4 mb-2 rounded-sm relative overflow-hidden",
        "px-4 py-3.5"
      )}
      style={{
        background: `${style.colour}16`,
        boxShadow: `inset 0 0 0 1px ${style.colour}55, 0 0 18px ${style.colour}1a`,
      }}
      title={`Current streak: ${current} day${current === 1 ? "" : "s"}. Longest: ${longest} day${longest === 1 ? "" : "s"}.`}
    >
      {/* Faint radial glow that pulls the eye to the chip. */}
      <span
        className="absolute -top-6 -right-4 h-20 w-20 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${style.colour}40 0%, transparent 60%)`,
          filter: "blur(8px)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-start gap-3">
        <Flame
          className="h-5 w-5 shrink-0 mt-1"
          style={{ color: style.colour }}
          strokeWidth={2}
          fill={style.colour}
          fillOpacity={0.3}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-serif font-bold tabular-nums leading-none"
              style={{ color: style.colour, fontSize: "26px" }}
            >
              {current}
            </span>
            <span
              className="font-mono uppercase tracking-[0.18em]"
              style={{ color: style.colour, fontSize: "10px" }}
            >
              day{current === 1 ? "" : "s"}
            </span>
          </div>
          <p
            className="font-mono uppercase tracking-[0.16em] mt-1.5 truncate"
            style={{ color: `${style.colour}cc`, fontSize: "10px" }}
          >
            {style.label}
          </p>
          {longest > current && (
            <p
              className="font-mono tabular-nums mt-0.5"
              style={{ color: `${style.colour}99`, fontSize: "10px", letterSpacing: "0.12em" }}
              title={`Longest run: ${longest} days`}
            >
              ↑ {longest} best
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
