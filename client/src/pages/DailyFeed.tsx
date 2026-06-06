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
import { CheckCheck, Copy, Flame, Info, X } from "lucide-react";
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
import { CoverageLeadCard } from "@/components/feed/CoverageLeadCard";
import { FeedItemCard } from "@/components/feed/FeedItemCard";
import { CoverageFeedCard } from "@/components/feed/CoverageFeedCard";
import { FeedSignalStrip } from "@/components/feed/FeedSignalStrip";
import { TodayInBrief } from "@/components/feed/TodayInBrief";
import { Skeleton } from "@/components/ui/Skeleton";
import { editionMeta, stories } from "@/data/editions/2026-05-15";
import { getSydneyIsoDate } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_FEED_CHANNEL,
  isEnrichedChannel,
  type FeedChannel,
} from "@shared/const";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DailyFeed() {
  // Two axes: `channel` is the Discover content lane (tabs); `filter` is the
  // category sub-filter that only applies within the AU flagship.
  const [channel, setChannel] = useState<FeedChannel>(DEFAULT_FEED_CHANNEL);
  const [filter, setFilter] = useState<CategoryFilter>("ALL");
  const [copied, setCopied] = useState(false);
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

  // Whether the active lane gets the full editorial treatment (angle blocks,
  // persona switcher, talking points, category sub-filter) or the lighter
  // coverage layout (clean lead + grid, no angles).
  const enriched = isEnrichedChannel(channel);

  const channelOf = (it: { channel?: string | null }): string =>
    (it.channel ?? "AU").toUpperCase();

  // Items in the active channel. Partitioned client-side so switching tabs is
  // instant — the query already returned every channel for the day.
  const channelItems = useMemo(
    () => allFeedItems.filter((it) => channelOf(it) === channel),
    [allFeedItems, channel]
  );

  // Categories present in the AU lane, for the sub-filter pills. Computed off
  // the AU items specifically so the chips never offer a topic the flagship
  // can't actually show.
  const auCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of allFeedItems) {
      if (channelOf(it) === "AU") set.add(it.category.toUpperCase());
    }
    return Array.from(set).sort();
  }, [allFeedItems]);

  // Apply the category sub-filter — AU flagship only. Every other lane is
  // already topically narrow, so the filter is ignored there.
  const feedItems = useMemo(() => {
    if (channel !== "AU" || filter === "ALL") return channelItems;
    return channelItems.filter((it) => it.category.toUpperCase() === filter);
  }, [channelItems, channel, filter]);

  // Render the live DB feed if there is one. Otherwise fall back to the
  // curated seed (for dev mode + first-launch before any ingest has run).
  const hasLiveData = allFeedItems.length > 0;

  // Seed-mode derived buckets (legacy three-tier layout). The static seed has
  // no channel axis, so it filters by category only and is only reachable
  // when there are zero live items.
  const filteredSeed = useMemo(
    () => (filter === "ALL" ? stories : stories.filter((s) => s.category === filter)),
    [filter]
  );
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
  // Grid note: the lede on every grid card is line-clamped (see
  // FeedItemCard) so summaries of wildly different lengths don't blow
  // row heights apart.
  const liveLead = feedItems[0];
  const liveRest = feedItems.slice(1);
  // A story earns the full grid treatment if it has EITHER a sayThis or a
  // partnerTag — FeedItemCard renders whichever angle(s) are present. Only
  // genuinely bare items (no angle at all) drop to the signals strip, so a
  // normal day surfaces many full-size stories rather than one lead + a wall
  // of signals.
  const hasAngles = (it: typeof feedItems[number]): boolean =>
    Boolean(
      (it.sayThis && it.sayThis.length > 0) ||
        (it.partnerTag && it.partnerTag.length > 0)
    );
  const allAngled = liveRest.filter(hasAngles);
  const nonAngled = liveRest.filter((it) => !hasAngles(it));
  // Sort the grid by approximate rendered card height so adjacent cards
  // in a row look similar — the first rows stay uniform and taller cards
  // cascade down, instead of the ragged gaps you get when feedItems
  // arrives in priority order (which has nothing to do with height).
  //
  // The estimate is in rough "line" units, NOT raw character counts: a
  // card's height is dominated by its STRUCTURAL blocks, not the length
  // of any one string. The Partner angles panel renders four fixed
  // persona rows on desktop regardless of text length, and "Why it
  // matters" / "Counterpoint" / "Say this" each add a bordered callout.
  // Counting characters alone let a Partner-angle card (very tall) sort
  // next to a card with just a long summary (short), which is what threw
  // the grid out of line.
  const TITLE_CHARS_PER_LINE = 26; // serif headline, narrow 3-col card
  const BODY_CHARS_PER_LINE = 46; // muted body copy at card width
  const estimatedCardHeight = (it: typeof feedItems[number]): number => {
    const bodyLines = (text: string | null | undefined, cap = Infinity): number =>
      Math.min(cap, Math.ceil((text?.length ?? 0) / BODY_CHARS_PER_LINE));
    // Fixed baseline: metadata bar, action row, and the card paddings.
    let lines = 4;
    // Headline wraps across however many lines its length implies.
    lines += Math.ceil(it.title.length / TITLE_CHARS_PER_LINE);
    // Summary is clamped to 3 lines in render, so it can never exceed that.
    lines += bodyLines(it.summary, 3);
    // Bordered callouts each cost a label line plus their wrapped copy.
    if (it.whyItMatters) lines += 1.5 + bodyLines(it.whyItMatters);
    if (it.counterpoint) lines += 1.5 + bodyLines(it.counterpoint);
    if (it.sayThis) lines += 1.5 + bodyLines(it.sayThis);
    // Partner angles is the big one: expanded on desktop it renders the
    // label plus all four persona rows no matter how short the text is,
    // so it contributes a large, roughly fixed block.
    if (it.partnerTag) lines += 6;
    return lines;
  };
  const angledSorted = [...allAngled].sort(
    (a, b) => estimatedCardHeight(a) - estimatedCardHeight(b)
  );
  // Enriched lanes (AU / Property): every angle-bearing story gets a full
  // card, height-sorted; the truly bare items fall through to the signals
  // strip. Coverage lanes (Business / Tech / Global) have no angles at all,
  // so everything after the lead is a clean grid card and there's no signals
  // strip — FeedItemCard hides the empty angle blocks automatically.
  const liveGrid = enriched ? angledSorted : liveRest;
  const liveSignals = enriched ? nonAngled : [];

  // Stories that have both a sayThis line and a partnerTag — the ones
  // actually ready to drop into a client conversation.
  const talkingPoints = useMemo(
    () => feedItems.filter((it) => it.sayThis && it.partnerTag),
    [feedItems]
  );

  async function copyTalkingPoints() {
    if (talkingPoints.length === 0) return;
    const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleString("en-AU", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    });
    const lines: string[] = [`Talking points · The Desk · ${dateLabel}`, ""];
    talkingPoints.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
      if (item.whyItMatters) lines.push(`   Why it matters: ${item.whyItMatters}`);
      lines.push(`   Say this: "${item.sayThis}"`);
      lines.push("");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable (non-https or denied) — fail silently
    }
  }

  return (
    <div className="space-y-10">
      <SectionErrorBoundary section="Hero">
        <Hero />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Author intro">
        <FromTheDeskIntro />
      </SectionErrorBoundary>

      <div className="space-y-6">
        {/* Orientation: which day you're reading, plus a quiet copy-all
            action for the talking points (demoted from a boxed amber CTA
            that competed with the hero). */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <DatePager
            date={date}
            isToday={isToday}
            canGoPrev={prevDate !== null}
            canGoNext={nextDate !== null}
            onPrev={() => prevDate && gotoDate(prevDate)}
            onNext={() => nextDate && gotoDate(nextDate)}
          />
          {hasLiveData && enriched && talkingPoints.length > 0 && (
            <button
              onClick={copyTalkingPoints}
              title={`Copy ${talkingPoints.length} talking point${talkingPoints.length === 1 ? "" : "s"} for today`}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors"
              style={{ color: copied ? "oklch(0.75 0.14 145)" : "var(--color-fg-subtle)" }}
            >
              {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : `Copy ${talkingPoints.length} talking point${talkingPoints.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>

        {/* Channel tabs lead the feed (Discover-style) and pin to the top as
            you scroll, so switching lane mid-scroll is one tap away. The
            category sub-filter row appears within the bar on the AU tab only. */}
        <SectionErrorBoundary section="Filters">
          <FilterChips
            channel={channel}
            onChannelChange={setChannel}
            category={filter}
            onCategoryChange={setFilter}
            categories={auCategories}
          />
        </SectionErrorBoundary>

        {/* Stories first: on the enriched lanes the day's scan sits directly
            under the tabs so a first-time reader meets the stories before the
            finer tools. Coverage lanes go straight to the lead + grid. */}
        {hasLiveData && enriched && (
          <SectionErrorBoundary section="Today in brief">
            <TodayInBrief items={feedItems} />
          </SectionErrorBoundary>
        )}

        {/* Tools: tune the persona, plus the first-run hint and 'what's new'
            marker. The persona switcher + hint are enriched-lane concepts
            (they explain Say This / partner angles), so they're hidden on the
            coverage lanes; the 'what's new' marker applies everywhere. */}
        <div className="space-y-5">
          {enriched && <PersonaSwitcher />}
          {enriched && <FeedHint />}
          <WhatsNewPill storyDates={storyTimestamps} storageKey="today" />
        </div>
      </div>

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
          {/* The 'Today in brief' scan now sits above the filter tools so
              stories land first; the lead + grid follow here. */}
          {liveLead && (
            <SectionErrorBoundary section="Lead">
              <section>
                <SectionDivider label="Today's lead" />
                {enriched ? (
                  <FeedLeadCard item={liveLead} />
                ) : (
                  <CoverageLeadCard item={liveLead} />
                )}
              </section>
            </SectionErrorBoundary>
          )}

          {liveGrid.length > 0 && (
            <SectionErrorBoundary section="Grid">
              <section>
                <SectionDivider label="More from today" />
                <StaggerList
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                  cacheKey={`grid-${channel}-${filter}`}
                >
                  {liveGrid.map((item) =>
                    enriched ? (
                      <FeedItemCard key={item.id} item={item} />
                    ) : (
                      <CoverageFeedCard key={item.id} item={item} />
                    )
                  )}
                </StaggerList>
              </section>
            </SectionErrorBoundary>
          )}

          {liveSignals.length > 0 && (
            <SectionErrorBoundary section="Signals">
              <section>
                <SectionDivider label="Further signals" />
                <StaggerList className="space-y-2.5" cacheKey={`signals-${channel}-${filter}`}>
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
          {channel === "AU" && filter !== "ALL"
            ? "No stories match this filter."
            : "No stories in this channel today."}
        </div>
      )}

      {/* Macro reference, parked below the feed and collapsed by default.
          A first-time reader meets the day's stories before the dashboard
          of numbers; anyone who wants the backdrop opens it from here. */}
      <SectionErrorBoundary section="Metrics">
        <MetricsStrip />
      </SectionErrorBoundary>

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

/**
 * One-time context strip for readers who aren't sure what they're looking at.
 * Explains the two things that confuse newcomers: what the topic chips do,
 * and what "partner angles / Say This" lines are for. Dismissed to
 * localStorage so it disappears after the first read without being modal.
 */
function FeedHint() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("thedesk:feed-hint-seen") !== "1";
  });
  if (!visible) return null;
  function dismiss() {
    window.localStorage.setItem("thedesk:feed-hint-seen", "1");
    setVisible(false);
  }
  return (
    <div
      className="flex items-start gap-3 rounded-sm px-4 py-3 text-[12.5px] text-[var(--color-fg-muted)] leading-relaxed"
      style={{
        background: "oklch(0.78 0.18 70 / 5%)",
        boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 15%)",
      }}
      role="note"
    >
      <Info className="h-3.5 w-3.5 text-amber-400/60 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="flex-1">
        <span className="text-[var(--color-fg)] font-medium">Channel tabs</span> switch
        between lanes — Australia, Property and the global coverage feeds. On
        Australia, the topic pills narrow the lane further. Stories with a
        coloured left border carry a{" "}
        <span className="text-[var(--color-fg)] font-medium">"Say This"</span> line — a
        ready-made conversation opener for your next client meeting.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="shrink-0 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
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
