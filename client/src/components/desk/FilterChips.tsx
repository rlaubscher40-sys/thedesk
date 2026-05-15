/**
 * Horizontally scrollable category filter row sitting beneath the date
 * pager. Selecting a chip filters the feed below.
 */
import { FEED_FILTERS, type Category } from "@/data/editions/2026-05-15";
import { cn } from "@/lib/cn";
import { categoryColour } from "@/lib/category";

export type CategoryFilter = Category | "ALL";

export function FilterChips({
  active,
  onChange,
}: {
  active: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by category"
      className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {FEED_FILTERS.map((f) => {
        const isActive = f.id === active;
        const colour = f.id === "ALL" ? "oklch(0.78 0.18 70)" : categoryColour(f.id);
        return (
          <button
            key={f.id}
            role="tab"
            aria-pressed={isActive}
            onClick={() => onChange(f.id)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full transition-all duration-200 text-[11px] font-mono uppercase tracking-[0.16em] flex items-center gap-2 border",
              isActive
                ? "text-[var(--color-fg)]"
                : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
            )}
            style={
              isActive
                ? {
                    background: `${colour}10`,
                    borderColor: `${colour}55`,
                  }
                : { borderColor: "var(--color-border)" }
            }
          >
            <span
              className="h-1 w-1 rounded-full transition-opacity"
              style={{ background: colour, opacity: isActive ? 1 : 0.35 }}
              aria-hidden="true"
            />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
