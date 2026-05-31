/**
 * Today, full-bleed daily-intelligence dashboard.
 *
 * Wired to the database when there are real feed items, falls back to the
 * curated seed Story array when the DB is empty (dev / first-boot / preview).
 *
 * DB layout:
 *   - Lead story = first item by createdAt
 *   - Grid below = items 2..7 (six in a 3-up at lg)
 *   - Signal column = everything beyond that, single-column
 *
 * Seed layout (untouched, same demo as before):
 *   - Featured → More → Further sections from the static stories array
 */
import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useStreak } from "@/lib/useStreak";
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
import { FeedSignalStrip } from "@/components/feed/FeedSignalStrip";
import { TodayInBrief } from "@/components/feed/TodayInBrief";
import { Skeleton } from "@/components/ui/Skeleton";
import { editionMeta, stories } from "@/data/editions/2026-05-15";
import { getSydneyIsoDate } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { trpc } from "@/lib/trpc";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DailyFeed() {
  const [filter, setFilter] = useState<CategoryFilter>("ALL");
  const { current: streakDays, tier: streakTier } = useStreak();

  // ── Historical day paging. The Today page accepts `?date=YYYY-MM-DD` so
  //    a reader can step back through past days; missing/invalid param
  //    resolves to the Sydney "today". DatePager is controlled, the prev /
  //    next chevrons walk the `getRecentDates` list (days that actually have
  //    items) rather than blindly decrementing the calendar.
  const search = useSearch();
  const [, navigate] = useLocation();
  const todayIso = getSydneyIsoDate();
  const dateParam = new URLSearchParams(search).get("date");
  const date = dateParam && ISO_DATE_RE.test(dateParam) ? dateParam : todayIso;
  const isToday = date === todayIso;

  const recentDatesQuery = trpc.feed.getRecentDates.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const availableDates = recentDatesQuery.data ?? [];

  const { prevDate, nextDate } = useMemo(() => {
    // Available dates are newest-first; the current `date` may or may not
    // be in the list (today might not have items yet).
    let prev: string | null = null;
    for (const d of availableDates) {
      if (d < date) {
        prev = d;
        break;
      }
    }
    let next: string | null = null;
    for (let i = availableDates.length - 1; i >= 0; i--) {
      const candidate = availableDates[i];
      if (candidate && candidate > date) {
        next = candidate;
        break;
      }
    }
    // If we're viewing a past date and today is newer than every available
    // date, still allow navigating forward to today (which might be empty
    // but is reachable as the canonical "Today").
    if (!next && date < todayIso) next = todayIso;
    return { prevDate: prev, nextDate: next };
  }, [availableDates, date, todayIso]);

  function gotoDate(target: string) {
    if (target === todayIso) navigate("/");
    else navigate(`/?date=${target}`);
  }

  // Pull the selected day's items from the DB. `staleTime` keeps it warm
  // for a minute so navigating away and back doesn't refetch.
  const feedQuery = trpc.feed.getByDate.useQuery(
    { date },
    { staleTime: 60_000 }
  );
  // Distinguish "no DB configured" (demo mode → render seed) from "DB
  // configured but empty" (production after a wipe → render empty state
  // with a re-run hint, not stale placeholders).
  const demoModeQuery = trpc.system.demoMode.useQuery();
  const isDemo = demoModeQuery.data?.demoMode ?? false;

  // Live feed items, pre-filtered through the user's topic allowlist
  // from Settings. When no allowlist is set this is a pass-through.
  const allFeedItems = useFilteredFeed(feedQuery.data ?? []);
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
  //
  // The split is editorial, not positional: a story earns the full
  // "More from today" treatment if it has a Say This line or partner
  // angles attached, i.e. the LLM judged it commercially relevant.
  // Stories without either (trending / awareness pieces, shark
  // attacks, celebrity news, off-beat global signals) drop into the
  // "Further signals" strip.
  //
  // Two extra rules on the grid:
  //   · Cards are rounded DOWN to a multiple of 3 so the grid always
  //     ends on a complete row. Leftover angle-bearing cards spill
  //     into "Further signals" rather than sitting orphaned with
  //     empty columns beside them.
  //   · The lede on every grid card is line-clamped (see
  //     FeedItemCard) so summaries of wildly different lengths
  //     don't blow row heights apart.
  const liveLead = feedItems[0];
  const liveRest = feedItems.slice(1);
  // Only items with BOTH partnerTag AND sayThis earn the full grid
  // treatment — they're rendered as a pair in FeedItemCard. A story
  // with one but not the other reads as half-equipped, so we treat it
  // the same as a no-angles item and demote it to the signals strip.
  const hasAngles = (it: typeof feedItems[number]): boolean =>
    Boolean(
      it.sayThis &&
        it.sayThis.length > 0 &&
        it.partnerTag &&
        it.partnerTag.length > 0
    );
  const allAngled = liveRest.filter(hasAngles);
  const nonAngled = liveRest.filter((it) => !hasAngles(it));
  // Sort the grid by approximate rendered card height (title + summary
  // + sayThis char counts) so adjacent cards in the same row look
  // similar — first row is the most uniform, taller cards cascade
  // down. Without this the first row often had the biggest visual
  // variance because feedItems arrives in priority order, which has
  // nothing to do with content length.
  const cardSize = (it: typeof feedItems[number]): number =>
    it.title.length +
    (it.summary?.length ?? 0) +
    (it.sayThis?.length ?? 0) +
    (it.partnerTag?.length ?? 0);
  const angledSorted = [...allAngled].sort((a, b) => cardSize(a) - cardSize(b));
  // Desktop grid is 3-col. Round down to a complete row.
  const GRID_COLS = 3;
  const gridSize = Math.floor(angledSorted.length / GRID_COLS) * GRID_COLS;
  const liveGrid = angledSorted.slice(0, gridSize);
  // Anything that didn't fit a complete row joins the signals strip —
  // angle-bearing or not, so the page never shows a lonely card with
  // two empty columns beside it.
  const liveSignals = [...angledSorted.slice(gridSize), ...nonAngled];

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
          <DatePager
            date={date}
            isToday={isToday}
            canGoPrev={prevDate !== null}
            canGoNext={nextDate !== null}
            onPrev={() => prevDate && gotoDate(prevDate)}
            onNext={() => nextDate && gotoDate(nextDate)}
          />
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

      {/* Mobile streak chip — the sidebar badge covers desktop, this
          surfaces the streak on mobile where there's no sidebar. */}
      {isToday && streakDays >= 2 && (
        <div className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-sm"
          style={{
            background: streakTier === "monthly" || streakTier === "fortnight"
              ? "oklch(0.75 0.12 145 / 12%)"
              : "oklch(0.78 0.18 70 / 10%)",
            boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 25%)",
          }}
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2} fill="currentColor" fillOpacity={0.4} />
          <span className="font-mono uppercase tracking-[0.16em] text-amber-300" style={{ fontSize: "10px" }}>
            {streakDays}-day streak
          </span>
          <span className="font-mono uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]" style={{ fontSize: "10px" }}>
            · {streakTier === "none" ? "New streak" : streakTier === "starter" ? "On a run" : streakTier === "weekly" ? "Weekly habit" : streakTier === "fortnight" ? "Two weeks" : "Monthly"}
          </span>
        </div>
      )}

      {/* ── Live feed (DB-driven) ────────────────────────────────────── */}
      {/* First load, query in flight: mirror the lead + grid layout with
          shimmer placeholders so the page has shape instead of dropping
          to blank space under the metrics strip until data arrives. */}
      {feedQuery.isLoading && !isDemo && <FeedSkeleton />}
      {!hasLiveData && !isDemo && feedQuery.isSuccess && (
        // Real DB, zero items. Don't show seed placeholders, they were
        // misleading after a wipe. Tell the editor what to do next.
        <EmptyFeedState />
      )}
      {hasLiveData ? (
        <>
          {/* Scan strip, every story today as dot points so partners can
              absorb the day in 10 seconds before drilling in. */}
          <SectionErrorBoundary section="Today in brief">
            <TodayInBrief items={feedItems} />
          </SectionErrorBoundary>

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
                <StaggerList className="space-y-2.5" cacheKey={`signals-${filter}`}>
                  {liveSignals.map((item) => (
                    <FeedSignalStrip key={item.id} item={item} />
                  ))}
                </StaggerList>
              </section>
            </SectionErrorBoundary>
          )}
        </>
      ) : isDemo ? (
        // ── Seed fallback, demo mode only. With a real DB but zero
        //    items we render <EmptyFeedState /> above this block instead.
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
      ) : null}

      {hasLiveData && feedItems.length === 0 && (
        <div className="panel p-8 rounded-sm text-center text-sm text-[var(--color-fg-muted)]">
          No items match this filter.
        </div>
      )}

      <SectionErrorBoundary section="LinkedIn">
        <LinkedInStrip />
      </SectionErrorBoundary>

      {/* Support strip replaces the right rail, four cards in one band. */}
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

/** Loading placeholder shaped like the live feed: one lead card over a
 *  three-up grid. Keeps perceived layout stable while the query resolves. */
function FeedSkeleton() {
  return (
    <div aria-busy="true">
      <SectionDivider label="Today's lead" />
      <div className="panel rounded overflow-hidden mx-auto w-full max-w-[960px] mb-12">
        <Skeleton className="w-full aspect-[5/3] rounded-none" />
        <div className="px-6 py-7 sm:px-10 sm:py-9 space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
      <SectionDivider label="More from today" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel rounded p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
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

/**
 * Real-DB-but-empty Today state. Shown after a wipe / before the first
 * daily-feed workflow run. Distinct from the seed fallback (demo mode)
 * so the editor knows to re-fire the ingest rather than wonder why
 * static placeholders are still showing up. Editor copy is gated to
 * admins so a partner reader doesn't see GitHub Actions plumbing.
 */
function EmptyFeedState() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <div className="panel rounded p-8 sm:p-10 text-center">
      <p
        className="overline-amber mb-3 inline-block"
        style={{ letterSpacing: "0.24em", fontSize: "10px" }}
      >
        Today's feed
      </p>
      <h2 className="font-serif text-2xl font-bold mb-3 leading-tight">
        The desk is quiet.
      </h2>
      <p className="text-sm text-[var(--color-fg-muted)] max-w-[58ch] mx-auto leading-relaxed mb-5">
        {isAdmin
          ? "The daily-feed workflow hasn't run yet today, or it was just wiped. Re-fire from GitHub Actions to repopulate."
          : "Today's brief hasn't landed yet. New stories arrive at 7am AEST on weekdays."}
      </p>
      {isAdmin && (
        <p
          className="font-mono uppercase text-[var(--color-fg-subtle)]"
          style={{ fontSize: "10px", letterSpacing: "0.18em" }}
        >
          GitHub · Actions · Daily Feed · Run workflow
        </p>
      )}
    </div>
  );
}
