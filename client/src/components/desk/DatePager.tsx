/**
 * Date pager — < 15/05/2026 > with a TODAY badge when the displayed date
 * is the Sydney "today". Always shows today's date (Sydney) since the
 * Today page itself represents today's brief.
 *
 * The arrow buttons are decorative for now — wire to historical archive
 * paging when the feed has been ingesting for a while and there are
 * meaningful previous days to flip through.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSydneyIsoDate } from "@/lib/date";
import { toast } from "sonner";

export function DatePager() {
  const today = getSydneyIsoDate();

  function noteUnavailable() {
    toast.message("Historical day pager isn't wired up yet.", {
      description: "Use the Archive to browse past feed items.",
    });
  }

  // Render today's date as dd/mm/yyyy — Australian convention.
  const [y, m, d] = today.split("-");
  const formatted = `${d}/${m}/${y}`;

  return (
    <div className="inline-flex items-center gap-1 panel rounded p-1">
      <button
        onClick={noteUnavailable}
        aria-label="Previous day"
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 px-3">
        <span className="font-mono text-xs tabular-nums text-[var(--color-fg)] tracking-wider">
          {formatted}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded"
          style={{
            background: "oklch(0.75 0.18 70 / 15%)",
            color: "oklch(0.88 0.19 82)",
            boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 40%)",
          }}
        >
          Today
        </span>
      </div>
      <button
        onClick={noteUnavailable}
        aria-label="Next day"
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
