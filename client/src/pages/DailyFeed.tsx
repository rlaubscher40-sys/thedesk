/**
 * Today — full-bleed daily-intelligence dashboard.
 *
 * Wired to the database when there are real feed items, falls back to the
 * curated seed Story array when the DB is empty (dev / first-boot / preview).
 *
 * DB layout:
 *   - Lead story = first item by createdAt
 *   - Grid below = items 2..7 (six in a 3-up at lg)
 *   - Signal column = everything beyond that, single-column
 *
 * Seed layout (untouched — same demo as before):
 *   - Featured → More → Further sections from the static stories array
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
import { LinkedInStrip } from "@/components/desk/LinkedInStrip";
import { PersonaSwitcher } from "@/components/desk/PersonaSwitcher";
import { SignalCard } from "@/components/desk/SignalCard";
import { StoryCard } from "@/components/desk/StoryCard";
import { WhatsNewPill } from "@/components/desk/WhatsNewPill";
import { MetricsStrip } from "@/components/desk/rightRail/MetricsStrip";
import { SupportStrip } from "@/components/desk/rightRail/SupportStrip";
import { FeedLeadCard } from "@/components/feed/FeedLeadCard";
import { FeedItemCard } from "@/components/feed/FeedItemCard";
import { editionMeta, stories } from "@/data/editions/2026-05-15";
import { trpc } from "@/lib/trpc";

export default function DailyFeed() {
  const [filter, setFilter] = useState<CategoryFilter>("ALL");

  // Pull today's items from the DB. `staleTime` keeps it warm for a minute
  // so navigating away and back doesn't refetch.
  const feedQuery = trpc.feed.getByDate.useQuery(undefined, {
    staleTime: 60_000,
  });

  const allFeedItems = feedQuery.data ?? [];
  const liveCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of allFeedItems) set.add(it.category.toUpperCase());
    return Array.from(set).sort();
  }, [allFeedItems]);

  const feedItems = useMemo(() => {
    if (filter === "ALL") return allFeedItems;
    return allFeedItems.filter((it) => it.category.toUpperCase() === filter);
  }, [allFeedItems, filter]);

  // Render the live DB feed if there is one. Otherwise fall back to the
  // curated seed (for dev mode + first-launch before any ingest has run).
  const hasLiveData = allFeedItems.length > 0;

  // Seed-mode derived buckets (legacy three-tier layout).
  const filteredSeed = useMemo(
    () => (filter === "ALL" ? stories : stories.filter((s) => s.category === filter)),
    [filter]
  );

  // Categories the chips should show. Live mode = whatever's in the DB
  // today; seed mode = the original handcurated set.
  const chipCategories = hasLiveData
    ? liveCategories
    : ["MACRO", "GEOPOLITICS", "PROPERTY", "AI", "MARKETS", "CLIMATE", "SPORT", "REDDIT", "CRYPTO"];
  const featured = filteredSeed.find((s) => s.section === "featured");
  const more = filteredSeed.filter((s) => s.section === "more");
  const further = filteredSeed.filter((s) => s.section === "further");

  // "What's new since last visit" needs an array of timestamps the user
  // could have missed. For live data, each item carries its own createdAt;
  // for seed mode, every story shares the same edition publish time.
  const editionPublishedMs = new Date(`${editionMeta.date}T07:00:00+10:00`).getTime();
  const storyTimestamps = hasLiveData
    ? feedItems.map((it) => new Date(it.createdAt).getTime())
    : filteredSeed.map(() => editionPublishedMs);

  // Live-mode buckets.
  const liveLead = feedItems[0];
  const liveGrid = feedItems.slice(1, 7);
  const liveSignals = feedItems.slice(7);

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
          <FilterChips
            active={filter}
            onChange={setFilter}
            categories={chipCategories}
          />
        </SectionErrorBoundary>
        <WhatsNewPill storyDates={storyTimestamps} storageKey="today" />
      </div>

      <SectionErrorBoundary section="Metrics">
        <MetricsStrip />
      </SectionErrorBoundary>

      {/* ── Live feed (DB-driven) ────────────────────────────────────── */}
      {hasLiveData ? (
        <>
          {liveLead && (
            <SectionErrorBoundary section="Lead">
              <section>
                <SectionDivider label="Today's lead" />
                <FeedLeadCard item={liveLead} />
              </section>
            </SectionErrorBoundary>
          )}

          {liveGrid.length > 0 && (
            <SectionErrorBoundary section="Grid">
              <section>
                <SectionDivider label="More from today" />
                <StaggerList
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                  cacheKey={`grid-${filter}`}
                >
                  {liveGrid.map((item) => (
                    <FeedItemCard key={item.id} item={item} />
                  ))}
                </StaggerList>
              </section>
            </SectionErrorBoundary>
          )}

          {liveSignals.length > 0 && (
            <SectionErrorBoundary section="Signals">
              <section>
                <SectionDivider label="Further signals" />
                <StaggerList className="space-y-4" cacheKey={`signals-${filter}`}>
                  {liveSignals.map((item) => (
                    <FeedItemCard key={item.id} item={item} />
                  ))}
                </StaggerList>
              </section>
            </SectionErrorBoundary>
          )}
        </>
      ) : (
        // ── Seed fallback (dev mode / pre-ingest) ───────────────────
        <>
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

          {filteredSeed.length === 0 && (
            <div className="panel p-8 rounded-sm text-center text-sm text-[var(--color-fg-muted)]">
              No items match this filter.
            </div>
          )}
        </>
      )}

      {hasLiveData && feedItems.length === 0 && (
        <div className="panel p-8 rounded-sm text-center text-sm text-[var(--color-fg-muted)]">
          No items match this filter.
        </div>
      )}

      <SectionErrorBoundary section="LinkedIn">
        <LinkedInStrip />
      </SectionErrorBoundary>

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
