/**
 * Date pager — < dd/mm/yyyy > with a TODAY badge when the displayed
 * date is the Sydney "today". Controlled component: the parent owns
 * the selected date and decides which neighbours are reachable.
 *
 * Disabled-state styling: dimmed chevron, no hover, cursor-not-allowed.
 * Arrows fire `onPrev` / `onNext` when their respective `canGoX` flag
 * is true.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Currently displayed date as YYYY-MM-DD. */
  date: string;
  /** True when `date` is the Sydney "today" — shows the TODAY badge. */
  isToday: boolean;
  /** True when there's an older feed-day to navigate back to. */
  canGoPrev: boolean;
  /** True when there's a newer feed-day to navigate forward to. */
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function DatePager({
  date,
  isToday,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: Props) {
  const [y, m, d] = date.split("-");
  const formatted = `${d}/${m}/${y}`;

  return (
    <div className="inline-flex items-center gap-1 panel rounded p-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Previous day"
        className={cn(
          "p-1.5 rounded transition-colors",
          canGoPrev
            ? "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
            : "text-[var(--color-fg-subtle)] opacity-40 cursor-not-allowed"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 px-3">
        <span className="font-mono text-xs tabular-nums text-[var(--color-fg)] tracking-wider">
          {formatted}
        </span>
        {isToday && (
          <span
            className="font-mono uppercase tracking-[0.18em] px-1.5 py-0.5 rounded"
            style={{
              fontSize: "10px",
              background: "oklch(0.75 0.18 70 / 15%)",
              color: "oklch(0.88 0.19 82)",
              boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 40%)",
            }}
          >
            Today
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next day"
        className={cn(
          "p-1.5 rounded transition-colors",
          canGoNext
            ? "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
            : "text-[var(--color-fg-subtle)] opacity-40 cursor-not-allowed"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
