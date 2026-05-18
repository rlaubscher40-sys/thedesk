/**
 * Horizontal chip selector for picking which day's feed to view. Editorial
 * brass-rail styling, mono caps, amber active state with a glow underline.
 */
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/cn";

export function FeedDatePicker({
  dates,
  selected,
  onSelect,
}: {
  dates: string[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  if (dates.length === 0) return null;
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1"
      role="tablist"
      aria-label="Feed dates"
    >
      {dates.map((date) => {
        const isActive = date === selected;
        const parsed = parseISO(date);
        const dayLabel = format(parsed, "EEE");
        const dateLabel = format(parsed, "d MMM");
        return (
          <button
            key={date}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(date)}
            className={cn(
              "shrink-0 px-3.5 py-2 rounded transition-all border relative group flex flex-col items-start gap-0.5",
              isActive
                ? "border-amber-400/60 bg-amber-500/10 text-amber-100 shadow-[0_0_18px_oklch(0.75_0.18_70/15%)]"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
            )}
          >
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-[0.16em] transition-colors",
                isActive ? "text-amber-300" : "text-[var(--color-fg-subtle)]"
              )}
            >
              {dayLabel}
            </span>
            <span
              className={cn(
                "font-serif text-sm leading-none tabular-nums",
                isActive ? "text-amber-100" : "text-[var(--color-fg)]"
              )}
            >
              {dateLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
