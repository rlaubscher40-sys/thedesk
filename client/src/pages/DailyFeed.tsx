/**
 * Today — full daily-intelligence dashboard.
 *
 * Three regions:
 *   · Main column: Hero → controls strip (date pager + persona switcher
 *     + filter chips) → three-section feed (FEATURED / MORE FROM TODAY /
 *     FURTHER SIGNALS) → Footer.
 *   · Right rail: Key Metrics, Today's Topics, Reading Queue, Latest
 *     Edition, Subscribe. Sticky on xl+, drops below the main column on
 *     anything narrower.
 *
 * All content comes from data/editions/2026-05-15.ts — no copy in JSX.
 */
import { useMemo, useState } from "react";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { StaggerList } from "@/components/StaggerList";
import { DatePager } from "@/components/desk/DatePager";
import { FeaturedCard } from "@/components/desk/FeaturedCard";
import { FilterChips, type CategoryFilter } from "@/components/desk/FilterChips";
import { Footer } from "@/components/desk/Footer";
import { Hero } from "@/components/desk/Hero";
import { PersonaSwitcher } from "@/components/desk/PersonaSwitcher";
import { SignalCard } from "@/components/desk/SignalCard";
import { StoryCard } from "@/components/desk/StoryCard";
import { KeyMetrics } from "@/components/desk/rightRail/KeyMetrics";
import { LatestEdition } from "@/components/desk/rightRail/LatestEdition";
import { ReadingQueueRail } from "@/components/desk/rightRail/ReadingQueueRail";
import { Subscribe } from "@/components/desk/rightRail/Subscribe";
import { TodaysTopics } from "@/components/desk/rightRail/TodaysTopics";
import { stories } from "@/data/editions/2026-05-15";

export default function DailyFeed() {
  const [filter, setFilter] = useState<CategoryFilter>("ALL");

  const filtered = useMemo(
    () => (filter === "ALL" ? stories : stories.filter((s) => s.category === filter)),
    [filter]
  );

  const featured = filtered.find((s) => s.section === "featured");
  const more = filtered.filter((s) => s.section === "more");
  const further = filtered.filter((s) => s.section === "further");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-8 xl:gap-10 2xl:gap-14">
      {/* ─── Main column ────────────────────────────────────────────── */}
      <div className="min-w-0">
        <SectionErrorBoundary section="Hero">
          <Hero />
        </SectionErrorBoundary>

        {/* Controls strip. */}
        <div className="mt-8 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DatePager />
            <PersonaSwitcher />
          </div>
          <SectionErrorBoundary section="Filters">
            <FilterChips active={filter} onChange={setFilter} />
          </SectionErrorBoundary>
        </div>

        {/* Three-section feed. */}
        <div className="mt-10 space-y-12">
          {featured && (
            <section>
              <SectionDivider label="Featured" />
              <SectionErrorBoundary section="Featured">
                <FeaturedCard story={featured} />
              </SectionErrorBoundary>
            </section>
          )}

          {more.length > 0 && (
            <section>
              <SectionDivider label="More from today" />
              <SectionErrorBoundary section="More from today">
                <StaggerList
                  className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5"
                  cacheKey={`more-${filter}`}
                >
                  {more.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </StaggerList>
              </SectionErrorBoundary>
            </section>
          )}

          {further.length > 0 && (
            <section>
              <SectionDivider label="Further signals" />
              <SectionErrorBoundary section="Further signals">
                <StaggerList
                  className="grid grid-cols-1 2xl:grid-cols-2 gap-5"
                  cacheKey={`further-${filter}`}
                >
                  {further.map((s) => (
                    <SignalCard key={s.id} story={s} />
                  ))}
                </StaggerList>
              </SectionErrorBoundary>
            </section>
          )}

          {filtered.length === 0 && (
            <div className="panel p-8 rounded text-center text-sm text-[var(--color-fg-muted)]">
              No items match this filter.
            </div>
          )}
        </div>

        <Footer />
      </div>

      {/* ─── Right rail ─────────────────────────────────────────────── */}
      <aside className="xl:sticky xl:top-6 xl:self-start space-y-5">
        <SectionErrorBoundary section="Key metrics">
          <KeyMetrics />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Today's topics">
          <TodaysTopics />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Reading queue">
          <ReadingQueueRail />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Latest edition">
          <LatestEdition />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Subscribe">
          <Subscribe />
        </SectionErrorBoundary>
      </aside>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-6 mb-7">
      <span
        className="font-mono uppercase tracking-[0.24em] shrink-0 text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px" }}
      >
        {label}
      </span>
      <span
        className="block flex-1 h-px bg-[var(--color-border)]"
        aria-hidden="true"
      />
    </div>
  );
}
