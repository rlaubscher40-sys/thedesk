/**
 * Discover-style header for the daily feed. Two rows:
 *
 *   1. Channel tabs — the content lanes (Australia, Property, Business, Tech,
 *      Global). Sticky underline tabs: flat mono labels with an accent
 *      underline on the active tab, arrow-key nav, auto-scroll-active-into-
 *      view. Switching a tab swaps the whole feed below to that lane.
 *
 *   2. Category sub-filter — a secondary pill row that appears ONLY on the AU
 *      flagship, where the lane is broad enough to warrant a topic filter
 *      (Macro / Markets / Policy …). The other lanes are each already
 *      topically narrow, so no sub-filter is shown there.
 *
 * Both rows sit inside one sticky, gutter-bleeding, backdrop-blurred bar so
 * the header pins as a single unit while stories scroll beneath it.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { categoryColour } from "@/lib/category";
import { FEED_CHANNELS, FEED_CHANNEL_LABELS, type FeedChannel } from "@shared/const";

/** A category sub-filter value: a category code, or "ALL". */
export type CategoryFilter = string;

/** Human-friendly label for a category code (sub-filter pills). */
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
  channel,
  onChannelChange,
  category,
  onCategoryChange,
  categories,
}: {
  /** Active content lane. */
  channel: FeedChannel;
  onChannelChange: (next: FeedChannel) => void;
  /** Active category sub-filter (AU only). "ALL" = no sub-filter. */
  category: CategoryFilter;
  onCategoryChange: (next: CategoryFilter) => void;
  /** Categories present in the AU lane, for the sub-filter pills (excludes
   *  ALL, which is always first). */
  categories: string[];
}) {
  const tabs = FEED_CHANNELS.map((id) => ({ id, label: FEED_CHANNEL_LABELS[id] }));

  // Keep the active tab in view when the row is horizontally scrolled (mobile),
  // so selecting a tab off-screen — or arrow-keying along — doesn't hide it.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [channel]);

  // Amber, The Desk's editorial accent, for the active channel underline. The
  // channels aren't categories, so they don't borrow the category palette.
  const ACCENT = "oklch(0.78 0.18 70)";

  const showSubFilter = channel === "AU" && categories.length > 0;
  const catChips = [
    { id: "ALL", label: LABELS.ALL! },
    ...categories.map((id) => ({ id, label: LABELS[id] ?? toTitle(id) })),
  ];

  return (
    // Sticky header. Negative margins bleed it to the content gutters so the
    // backdrop fully masks stories scrolling beneath it; the matching padding
    // re-insets the rows to the reading column.
    <div
      className={cn(
        "sticky top-0 z-20",
        "-mx-5 sm:-mx-8 lg:-mx-12 xl:-mx-16 2xl:-mx-20",
        "px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20",
        "bg-[var(--color-bg)]/85 backdrop-blur-md"
      )}
    >
      {/* Channel tabs. The bottom border is the track the active underline
          sits on. */}
      <div
        role="tablist"
        aria-label="Content channels"
        className="flex gap-6 overflow-x-auto no-scrollbar border-b border-[var(--color-border)]"
        style={{ scrollbarWidth: "none" }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = tabs.findIndex((t) => t.id === channel);
          const next =
            e.key === "ArrowRight"
              ? tabs[Math.min(i + 1, tabs.length - 1)]
              : tabs[Math.max(i - 1, 0)];
          if (next) onChannelChange(next.id);
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === channel;
          return (
            <button
              key={t.id}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChannelChange(t.id)}
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
                style={{ background: ACCENT, opacity: isActive ? 1 : 0 }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {/* Category sub-filter, AU flagship only. Pill styling (distinct from the
          channel underline tabs) marks it as a secondary, optional refinement
          rather than a top-level lane switch. */}
      {showSubFilter && (
        <div
          role="group"
          aria-label="Filter Australia by topic"
          className="flex gap-2 overflow-x-auto no-scrollbar pt-2.5 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {catChips.map((f) => {
            const isActive = f.id === category;
            const colour =
              f.id === "ALL" ? "oklch(0.78 0.18 70)" : categoryColour(f.id as never);
            return (
              <button
                key={f.id}
                aria-pressed={isActive}
                onClick={() => onCategoryChange(f.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full transition-all duration-200 text-[11px] font-mono uppercase tracking-[0.16em] flex items-center gap-2 border",
                  isActive
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
                )}
                style={
                  isActive
                    ? { background: `${colour}10`, borderColor: `${colour}55` }
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
      )}
    </div>
  );
}

function toTitle(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
