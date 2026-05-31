/**
 * Sidebar reading-streak chip. Renders only when the streak ≥ 1.
 * Tier-coloured: amber → emerald → champagne as the streak grows.
 *
 * Full view: count, tier label, longest-run accent, and a weekday
 * dot grid (Mon–Fri of the current week) so the streak feels like
 * something worth protecting, not just a number.
 */
import { Flame } from "lucide-react";
import { getSydneyIsoDate } from "@/lib/date";
import { useStreak, type StreakTier } from "@/lib/useStreak";
import { cn } from "@/lib/cn";

const TIER_STYLE: Record<StreakTier, { colour: string; label: string }> = {
  none: { colour: "var(--color-fg-subtle)", label: "New streak" },
  starter: { colour: "var(--color-amber)", label: "On a run" },
  weekly: { colour: "var(--color-amber-bright)", label: "Weekly habit" },
  fortnight: { colour: "var(--color-property)", label: "Two weeks running" },
  monthly: { colour: "var(--color-amber-bright)", label: "Monthly streak" },
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F"];

/** Returns YYYY-MM-DD for each weekday (Mon–Fri) of the week containing `isoDate`. */
function currentWeekdays(isoDate: string): string[] {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return [0, 1, 2, 3, 4].map((i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

export function StreakBadge({ collapsed }: { collapsed?: boolean }) {
  const { current, longest, tier, history } = useStreak();
  if (current < 1) return null;
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

  const today = getSydneyIsoDate();
  const weekdays = currentWeekdays(today);

  return (
    <div
      className={cn("mx-3 mt-4 mb-2 rounded-sm relative overflow-hidden", "px-4 py-3.5")}
      style={{
        background: `${style.colour}16`,
        boxShadow: `inset 0 0 0 1px ${style.colour}55, 0 0 18px ${style.colour}1a`,
      }}
      title={`Current streak: ${current} day${current === 1 ? "" : "s"}. Longest: ${longest} day${longest === 1 ? "" : "s"}.`}
    >
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
            >
              ↑ {longest} best
            </p>
          )}

          {/* Weekday dot grid — Mon through Fri of the current week */}
          <div className="flex items-center gap-1.5 mt-3" aria-label="This week's visits">
            {weekdays.map((date, i) => {
              const visited = history.includes(date);
              const isToday = date === today;
              const isFuture = date > today;
              return (
                <div key={date} className="flex flex-col items-center gap-0.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: visited
                        ? style.colour
                        : isFuture
                        ? `${style.colour}12`
                        : `${style.colour}28`,
                      boxShadow: isToday && visited
                        ? `0 0 6px ${style.colour}`
                        : undefined,
                      outline: isToday ? `1px solid ${style.colour}80` : undefined,
                      outlineOffset: "1px",
                    }}
                    title={date}
                  />
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "8px",
                      color: isToday ? style.colour : `${style.colour}60`,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {WEEKDAY_LABELS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
