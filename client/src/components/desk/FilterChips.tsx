/**
 * Topic tab bar sitting at the top of the daily feed. Selecting a tab filters
 * the feed below. Styled as underline tabs (an editorial take on the
 * Discover-style topic row) rather than pills — flat mono labels with an
 * accent underline on the active tab, kept in The Desk's dark / amber system.
 *
 * Categories are computed from whatever's actually on the page: in live mode
 * that's the distinct set across the day's feed items; in seed mode it's the
 * legacy seed categories. Either way we never show a tab the user can't
 * actually filter to.
 *
 * The component keeps its original name + props (`active`, `onChange`,
 * `categories`) so the only call site — DailyFeed — needs no rewiring.
 */
import { useEffect, useRef } from "react";
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
  /** Categories to render as tabs (excludes ALL, that's always first). */
  categories: string[];
}) {
  const tabs = [
    { id: "ALL", label: LABELS.ALL! },
    ...categories.map((id) => ({ id, label: LABELS[id] ?? toTitle(id) })),
  ];

  // Keep the active tab in view when the row is horizontally scrolled (mobile),
  // so selecting a tab off-screen — or arrow-keying along — doesn't hide it.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  return (
    // Sticky topic bar. Negative margins bleed it to the content gutters so the
    // backdrop fully masks stories scrolling beneath it; the matching padding
    // re-insets the tabs to the reading column. The bottom border is the track
    // the active underline sits on.
    <div
      className={cn(
        "sticky top-0 z-20",
        "-mx-5 sm:-mx-8 lg:-mx-12 xl:-mx-16 2xl:-mx-20",
        "px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20",
        "bg-[var(--color-bg)]/85 backdrop-blur-md",
        "border-b border-[var(--color-border)]"
      )}
    >
      <div
        role="tablist"
        aria-label="Filter by topic"
        className="flex gap-6 overflow-x-auto no-scrollbar"
        style={{ scrollbarWidth: "none" }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = tabs.findIndex((t) => t.id === active);
          const next =
            e.key === "ArrowRight"
              ? tabs[Math.min(i + 1, tabs.length - 1)]
              : tabs[Math.max(i - 1, 0)];
          if (next) onChange(next.id);
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          const colour =
            t.id === "ALL" ? "oklch(0.78 0.18 70)" : categoryColour(t.id as never);
          return (
            <button
              key={t.id}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={cn(
                "relative shrink-0 whitespace-nowrap pt-1 pb-3 text-[11px] font-mono uppercase tracking-[0.18em] transition-colors duration-200",
                isActive
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
              )}
            >
              {t.label}
              {/* Active underline, overlapping the track border below. */}
              <span
                className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity duration-200"
                style={{ background: colour, opacity: isActive ? 1 : 0 }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toTitle(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
