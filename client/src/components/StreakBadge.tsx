/**
 * Sidebar reading-streak chip. Renders only when the streak ≥ 2 days
 * (a single visit isn't a streak yet). Tier-coloured: amber → emerald
 * → champagne as the streak grows. Tooltip surfaces the longest run.
 */
import { Flame } from "lucide-react";
import { useStreak, type StreakTier } from "@/lib/useStreak";
import { cn } from "@/lib/cn";

const TIER_STYLE: Record<StreakTier, { colour: string; label: string }> = {
  none: { colour: "var(--color-fg-subtle)", label: "" },
  starter: { colour: "oklch(0.78 0.18 70)", label: "On a run" },
  weekly: { colour: "oklch(0.85 0.18 78)", label: "Weekly habit" },
  fortnight: { colour: "oklch(0.72 0.17 155)", label: "Two weeks running" },
  monthly: { colour: "oklch(0.92 0.16 84)", label: "Monthly streak" },
};

export function StreakBadge({ collapsed }: { collapsed?: boolean }) {
  const { current, longest, tier } = useStreak();
  if (current < 2) return null;
  const style = TIER_STYLE[tier];

  return (
    <div
      className={cn(
        "mx-2 mt-3 mb-1 rounded-sm flex items-center gap-2 px-3 py-2 transition-colors",
        collapsed && "justify-center px-0 mx-1.5"
      )}
      style={{
        background: `${style.colour}10`,
        boxShadow: `inset 0 0 0 1px ${style.colour}38`,
      }}
      title={`Current streak: ${current} day${current === 1 ? "" : "s"}. Longest: ${longest} day${longest === 1 ? "" : "s"}.`}
    >
      <Flame
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: style.colour }}
        strokeWidth={2}
      />
      {!collapsed && (
        <span
          className="flex-1 min-w-0 font-mono uppercase tracking-[0.16em] truncate"
          style={{ color: style.colour, fontSize: "10px" }}
        >
          {current} day{current === 1 ? "" : "s"}
        </span>
      )}
      {!collapsed && (
        <span
          className="font-mono tabular-nums"
          style={{ color: `${style.colour}99`, fontSize: "9px" }}
        >
          {longest > current ? `· ${longest} best` : ""}
        </span>
      )}
    </div>
  );
}
