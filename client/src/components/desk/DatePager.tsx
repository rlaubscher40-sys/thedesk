/**
 * Date pager — < 15/05/2026 > with a TODAY badge when the displayed
 * date is the Sydney "today". The arrows are decorative in demo mode
 * (only one edition shipped); wire to a server call in production.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { editionMeta } from "@/data/editions/2026-05-15";
import { getSydneyIsoDate } from "@/lib/date";
import { toast } from "sonner";

export function DatePager() {
  const today = getSydneyIsoDate();
  const isToday = editionMeta.date === today;

  function noteUnavailable() {
    toast.message("Only today's edition is loaded in demo mode.", {
      description: "Production builds page back to any historical edition.",
    });
  }

  // Render the date as dd/mm/yyyy for the pager — Australian convention.
  const formatted = (() => {
    const [y, m, d] = editionMeta.date.split("-");
    return `${d}/${m}/${y}`;
  })();

  return (
    <div className="inline-flex items-center gap-1 panel rounded p-1">
      <button
        onClick={noteUnavailable}
        aria-label="Previous edition"
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 px-3">
        <span className="font-mono text-xs tabular-nums text-[var(--color-fg)] tracking-wider">
          {formatted}
        </span>
        {isToday && (
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
        )}
      </div>
      <button
        onClick={noteUnavailable}
        aria-label="Next edition"
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
