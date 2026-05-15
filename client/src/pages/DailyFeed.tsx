/**
 * Today — full-bleed daily-intelligence dashboard.
 *
 * Single editorial column. The right rail is gone — it was forcing the
 * main feed to share the page horizontally with metadata that didn't
 * deserve that real estate. Everything reflows top-to-bottom:
 *
 *   1. Hero
 *   2. Controls strip (date pager + persona switcher + filter chips)
 *   3. Metrics strip (full width, 4 KPI tiles)
 *   4. Featured story (full width)
 *   5. More from today (2-up grid, full width)
 *   6. Further signals (wide single-column cards)
 *   7. Support strip (Topics · Reading Queue · Latest · Subscribe)
 *   8. Footer
 */
import { useMemo, useState } from "react";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { StaggerList } from "@/components/StaggerList";
import { DatePager } from "@/components/desk/DatePager";
import { FeaturedCard } from "@/components/desk/FeaturedCard";
import { FilterChips, type CategoryFilter } from "@/components/desk/FilterChips";
import { Footer } from "@/components/desk/Footer";
import { FromTheDeskIntro } from "@/components/desk/FromTheDeskIntro";
import { Hero } from "@/components/desk/Hero";
import { PersonaSwitcher } from "@/components/desk/PersonaSwitcher";
import { SignalCard } from "@/components/desk/SignalCard";
import { StoryCard } from "@/components/desk/StoryCard";
import { WhatsNewPill } from "@/components/desk/WhatsNewPill";
import { MetricsStrip } from "@/components/desk/rightRail/MetricsStrip";
import { SupportStrip } from "@/components/desk/rightRail/SupportStrip";
import { editionMeta, stories } from "@/data/editions/2026-05-15";

export default function DailyFeed() {
  const [filter, setFilter] = useState<CategoryFilter>("ALL");

  const filtered = useMemo(
    () => (filter === "ALL" ? stories : stories.filter((s) => s.category === filter)),
    [filter]
  );

  const featured = filtered.find((s) => s.section === "featured");
  const more = filtered.filter((s) => s.section === "more");
  const further = filtered.filter((s) => s.section === "further");

  // Edition publish time = 7am Sydney on editionMeta.date. We treat every
  // story on the page as having landed at that moment for the "what's new"
  // calculation. When this page is wired to real DB items, swap to each
  // item's createdAt.
  const editionPublishedMs = new Date(`${editionMeta.date}T07:00:00+10:00`).getTime();
  const storyTimestamps = filtered.map(() => editionPublishedMs);

  return (
    <div className="space-y-12">
      <SectionErrorBoundary section="Hero">
        <Hero />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Author intro">
        <FromTheDeskIntro />
      </SectionErrorBoundary>

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <DatePager />
          <PersonaSwitcher />
        </div>
        <SectionErrorBoundary section="Filters">
          <FilterChips active={filter} onChange={setFilter} />
        </SectionErrorBoundary>
        <WhatsNewPill storyDates={storyTimestamps} storageKey="today" />
      </div>

      <SectionErrorBoundary section="Metrics">
        <MetricsStrip />
      </SectionErrorBoundary>

      {featured && (
        <SectionErrorBoundary section="Featured">
          <section>
            <SectionDivider label="Featured" />
            <FeaturedCard story={featured} />
          </section>
        </SectionErrorBoundary>
      )}

      {more.length > 0 && (
        <SectionErrorBoundary section="More from today">
          <section>
            <SectionDivider label="More from today" />
            <StaggerList
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
              cacheKey={`more-${filter}`}
            >
              {more.map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
            </StaggerList>
          </section>
        </SectionErrorBoundary>
      )}

      {further.length > 0 && (
        <SectionErrorBoundary section="Further signals">
          <section>
            <SectionDivider label="Further signals" />
            <StaggerList className="space-y-4" cacheKey={`further-${filter}`}>
              {further.map((s) => (
                <SignalCard key={s.id} story={s} />
              ))}
            </StaggerList>
          </section>
        </SectionErrorBoundary>
      )}

      {filtered.length === 0 && (
        <div className="panel p-8 rounded-sm text-center text-sm text-[var(--color-fg-muted)]">
          No items match this filter.
        </div>
      )}

      {/* Support strip replaces the right rail — four cards in one band. */}
      <SectionErrorBoundary section="Support strip">
        <section className="pt-4">
          <SectionDivider label="The desk" />
          <SupportStrip />
        </section>
      </SectionErrorBoundary>

      <Footer />
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
