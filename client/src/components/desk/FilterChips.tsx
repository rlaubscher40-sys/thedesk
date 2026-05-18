/**
 * Horizontally scrollable category filter row sitting beneath the date
 * pager. Selecting a chip filters the feed below.
 *
 * Categories are computed from whatever's actually on the page, in
 * live mode that's the distinct set of categories across the day's
 * feed items; in seed mode it's the legacy seed categories. Either way,
 * we never show a chip the user can't actually filter to.
 */
import { cn } from "@/lib/cn";
import { categoryColour } from "@/lib/category";

export type CategoryFilter = string;

/** Human-friendly label for a category code. */
const LABELS: Record<string, string> = {
  ALL: "All",
  MACRO: "Macro",
  PROPERTY: "Property",
  MARKETS: "Markets",
  POLICY: "Policy",
  ECONOMICS: "Economics",
  TECH: "Tech",
  AI: "AI",
  GEOPOLITICS: "Geopolitics",
  SCIENCE: "Science",
  OTHER: "Other",
  // Legacy seed-only categories, preserved so the seed fallback still
  // renders something sensible during dev / first boot.
  CLIMATE: "Climate",
  SPORT: "Sport, Culture and Entertainment",
  CULTURE: "Sport, Culture and Entertainment",
  REDDIT: "Reddit Community Sentiment",
  CRYPTO: "Crypto",
};

export function FilterChips({
  active,
  onChange,
  categories,
}: {
  active: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  /** Categories to render as chips (excludes ALL, that's always first). */
  categories: string[];
}) {
  const chips = [
    { id: "ALL", label: LABELS.ALL! },
    ...categories.map((id) => ({ id, label: LABELS[id] ?? toTitle(id) })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by category"
      className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {chips.map((f) => {
        const isActive = f.id === active;
        const colour =
          f.id === "ALL" ? "oklch(0.78 0.18 70)" : categoryColour(f.id as never);
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

function toTitle(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
