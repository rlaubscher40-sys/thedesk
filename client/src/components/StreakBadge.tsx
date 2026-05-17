/**
 * Sidebar reading-streak chip. Renders only when the streak ≥ 2 days
 * (a single visit isn't a streak yet). Tier-coloured: amber → emerald
 * → champagne as the streak grows. Tooltip surfaces the longest run.
 *
 * Text contrast was previously too faint to read at a glance — the
 * count rendered at fontSize 10px in the same colour as the chip
 * background at 60% alpha. Now: number at 13px in serif, full-strength
 * tier colour; "DAYS" mono label below; chip background pulled to 14%
 * alpha so the contrast holds without overpowering the sidebar.
 */
import { Flame } from "lucide-react";
import { useStreak, type StreakTier } from "@/lib/useStreak";
import { cn } from "@/lib/cn";

const TIER_STYLE: Record<StreakTier, { colour: string; label: string }> = {
  none: { colour: "var(--color-fg-subtle)", label: "" },
  starter: { colour: "oklch(0.82 0.18 72)", label: "On a run" },
  weekly: { colour: "oklch(0.88 0.18 80)", label: "Weekly habit" },
  fortnight: { colour: "oklch(0.78 0.17 155)", label: "Two weeks running" },
  monthly: { colour: "oklch(0.94 0.16 84)", label: "Monthly streak" },
};

export function StreakBadge({ collapsed }: { collapsed?: boolean }) {
  const { current, longest, tier } = useStreak();
  if (current < 2) return null;
  const style = TIER_STYLE[tier];

  return (
    <div
      className={cn(
        "mx-2 mt-3 mb-1 rounded-sm flex items-center gap-2.5 px-3 py-2.5 transition-colors",
        collapsed && "justify-center px-0 mx-1.5"
      )}
      style={{
        background: `${style.colour}14`,
        boxShadow: `inset 0 0 0 1px ${style.colour}50`,
      }}
      title={`Current streak: ${current} day${current === 1 ? "" : "s"}. Longest: ${longest} day${longest === 1 ? "" : "s"}.`}
    >
      <Flame
        className="h-4 w-4 shrink-0"
        style={{ color: style.colour }}
        strokeWidth={2}
        fill={style.colour}
        fillOpacity={0.25}
      />
      {!collapsed && (
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
          <span
            className="font-serif font-bold tabular-nums leading-none"
            style={{ color: style.colour, fontSize: "16px" }}
          >
            {current}
          </span>
          <span
            className="font-mono uppercase tracking-[0.18em]"
            style={{ color: style.colour, fontSize: "9px" }}
          >
            day{current === 1 ? "" : "s"}
          </span>
          {longest > current && (
            <span
              className="ml-auto font-mono tabular-nums shrink-0"
              style={{ color: `${style.colour}cc`, fontSize: "9px" }}
              title={`Longest run: ${longest} days`}
            >
              ↑ {longest}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
