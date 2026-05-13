/**
 * Horizontal chip selector for picking which day's feed to view. The list
 * comes from feed.getRecentDates and renders the most recent 14.
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
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Feed dates">
      {dates.map((date) => {
        const isActive = date === selected;
        const label = format(parseISO(date), "EEE d MMM");
        return (
          <button
            key={date}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(date)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wide transition-colors border",
              isActive
                ? "border-amber-400/60 bg-amber-500/15 text-amber-200"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
