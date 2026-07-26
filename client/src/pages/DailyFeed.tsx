/**
 * Today — the broadsheet front page.
 *
 * Order, top to bottom: utility bar, masthead, lane nav, index strip,
 * lead, Say This, Where things stand, More from today, Also on the wire,
 * subscribe band. (The footer is rendered by the shell.)
 *
 * Wired to the database when there are real feed items, falling back to
 * the curated seed Story array only in demo mode, exactly as before. What
 * changed with the redesign:
 *
 *   · Hero and FromTheDeskIntro are deleted — the masthead carries the
 *     attribution, and a photo band whose only message was "Today's Desk"
 *     was six blocks of chrome before the first story.
 *   · The channel tabs moved into <LaneNav> and are no longer sticky; the
 *     category sub-filter moved to the Archive, so `filter` state and its
 *     localStorage key are gone from this page.
 *   · The `Ruben's read` collapse is gone: Say This and the partner angles
 *     render inline. With hairline columns instead of floating cards,
 *     ragged column heights aren't a defect, so the `estimatedCardHeight`
 *     sort that used to pre-order the grid went with it.
 *   · MetricsStrip is replaced by <WhereThingsStand>, expanded by default
 *     and carrying real charts.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Masthead } from "@/components/broadsheet/Masthead";
import { UtilityBar } from "@/components/broadsheet/UtilityBar";
import { AngledForChips, LaneNav } from "@/components/broadsheet/LaneNav";
import { SayThis } from "@/components/broadsheet/SayThis";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { WhereThingsStand } from "@/components/broadsheet/MetricBlocks";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { IndexStrip } from "@/components/broadsheet/today/IndexStrip";
import { Lead } from "@/components/broadsheet/today/Lead";
import { StoryColumns } from "@/components/broadsheet/today/StoryColumns";
import { Wire } from "@/components/broadsheet/today/Wire";
import { LeadEnrichmentWarning } from "@/components/feed/LeadEnrichmentWarning";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { editionMeta, stories } from "@/data/editions/2026-05-15";
import { getSydneyIsoDate } from "@/lib/date";
import { readingMinutes } from "@/lib/readingTime";
import { useAuth } from "@/lib/useAuth";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { useStreak } from "@/lib/useStreak";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_FEED_CHANNEL,
  FEED_CHANNELS,
  isEnrichedChannel,
  type FeedChannel,
} from "@shared/const";

const LANE_CHANNEL_KEY = "thedesk:lane-channel";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DailyFeed() {
  // `channel` is the Discover content lane. Persisted so a returning reader
  // lands back in their preferred lane instead of the AU default.
  const [channel, setChannel] = useState<FeedChannel>(() => {
    if (typeof window === "undefined") return DEFAULT_FEED_CHANNEL;
    const saved = window.localStorage.getItem(LANE_CHANNEL_KEY);
    return saved && (FEED_CHANNELS as readonly string[]).includes(saved)
      ? (saved as FeedChannel)
      : DEFAULT_FEED_CHANNEL;
  });
  useEffect(() => {
    window.localStorage.setItem(LANE_CHANNEL_KEY, channel);
  }, [channel]);

  const { current: streakDays } = useStreak();

  // ── Historical day paging. `?date=YYYY-MM-DD` steps back through past
  //    days; a missing/invalid param resolves to the Sydney "today". The
  //    chevrons walk `getRecentDates` (days that actually have items)
  //    rather than blindly decrementing the calendar.
  const search = useSearch();
  const [, navigate] = useLocation();
  const todayIso = getSydneyIsoDate();
  const dateParam = new URLSearchParams(search).get("date");
  const date = dateParam && ISO_DATE_RE.test(dateParam) ? dateParam : todayIso;
  const isToday = date === todayIso;

  const recentDatesQuery = trpc.feed.getRecentDates.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const availableDates = useMemo(() => recentDatesQuery.data ?? [], [recentDatesQuery.data]);

  const { prevDate, nextDate } = useMemo(() => {
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
    if (!next && date < todayIso) next = todayIso;
    return { prevDate: prev, nextDate: next };
  }, [availableDates, date, todayIso]);

  function gotoDate(target: string) {
    if (target === todayIso) navigate("/");
    else navigate(`/?date=${target}`);
  }

  const feedQuery = trpc.feed.getByDate.useQuery({ date }, { staleTime: 60_000 });
  // Distinguish "no DB configured" (demo mode → render seed) from "DB
  // configured but empty" (production after a wipe → empty state).
  const demoModeQuery = trpc.system.demoMode.useQuery();
  const isDemo = demoModeQuery.data?.demoMode ?? false;

  // Live feed items, pre-filtered through the user's topic allowlist.
  const allFeedItems = useFilteredFeed(feedQuery.data ?? []);
  const enriched = isEnrichedChannel(channel);

  const channelOf = (it: { channel?: string | null }): string =>
    (it.channel ?? "AU").toUpperCase();

  // Items in the active lane. Partitioned client-side so switching lanes is
  // instant — the query already returned every channel for the day.
  const feedItems = useMemo(
    () => allFeedItems.filter((it) => channelOf(it) === channel),
    [allFeedItems, channel]
  );

  const hasLiveData = allFeedItems.length > 0;

  // ── Lead worthiness gate (enriched lanes only) ────────────────────────
  // The lead earns its slot: it carries the full broadsheet treatment, so
  // if it can't fill the slots that treatment exists to hold (context, the
  // take, the angles) it isn't the lead. An admin pin (priority >= 100) is
  // an explicit override. Coverage lanes have no enrichment by design, so
  // the gate doesn't apply there.
  const isLeadWorthy = (it: (typeof feedItems)[number]): boolean => {
    const hasContext = !!(it.summary?.trim() || it.whyItMatters?.trim());
    const hasTake = !!(it.sayThis?.trim() || it.rubensNote?.trim());
    const hasAnglesBlock = !!it.partnerTag?.trim();
    return hasContext && hasTake && hasAnglesBlock;
  };
  const pinned = feedItems.find((it) => (it.priority ?? 50) >= 100);
  const lead = enriched
    ? (pinned ?? feedItems.find(isLeadWorthy) ?? feedItems[0])
    : feedItems[0];
  const rest = feedItems.filter((it) => it.id !== lead?.id);
  const leadIsFallback = enriched && !pinned && !!lead && !isLeadWorthy(lead);

  // A story earns a full column if it has either a Say This or partner
  // angles; genuinely bare items drop to the wire.
  const hasAngles = (it: (typeof feedItems)[number]): boolean =>
    Boolean(it.sayThis?.length || it.partnerTag?.length);
  const columns = enriched ? rest.filter(hasAngles) : rest;
  const wire = enriched ? rest.filter((it) => !hasAngles(it)) : [];

  // Stories ready to drop into a client conversation, for the bulk copy.
  const talkingPoints = useMemo(
    () => feedItems.filter((it) => it.sayThis && it.partnerTag),
    [feedItems]
  );

  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const totalMinutes = feedItems.reduce((sum, it) => sum + readingMinutes(it), 0);
  const shapeLine = hasLiveData
    ? `${feedItems.length} ${feedItems.length === 1 ? "story" : "stories"} · ${totalMinutes} min · curated by Ruben Laubscher`
    : "Curated by Ruben Laubscher";

  return (
    <>
      <UtilityBar filedLine={isToday ? "Filed 7am AEST · Sydney" : `Archive · ${date}`}>
        <DatePagerInline
          date={date}
          isToday={isToday}
          canGoPrev={prevDate !== null}
          canGoNext={nextDate !== null}
          onPrev={() => prevDate && gotoDate(prevDate)}
          onNext={() => nextDate && gotoDate(nextDate)}
        />
        {/* Secondary utility-bar controls stay off the phone, where the row
            would wrap to three lines above the masthead. */}
        {enriched && talkingPoints.length > 0 && (
          <span className="hidden md:inline">
            <CopyTalkingPoints items={talkingPoints} date={date} />
          </span>
        )}
        {isToday && streakDays >= 2 && (
          <span
            className="bs-label hidden md:inline"
            style={{ color: "var(--color-accent-text)" }}
          >
            · {streakDays}-day streak
          </span>
        )}
      </UtilityBar>

      <Masthead dateLabel={dateLabel} shapeLine={shapeLine} />

      <SectionErrorBoundary section="Lane nav">
        <LaneNav channel={channel} onChannelChange={setChannel} />
        {enriched && <AngledForChips />}
      </SectionErrorBoundary>

      {feedQuery.isLoading && !isDemo && <FeedSkeleton />}

      {!hasLiveData && !isDemo && feedQuery.isSuccess && <EmptyFeedState />}

      {hasLiveData && feedItems.length === 0 && (
        <p className={cn(GUTTER_X, "py-16 text-center text-[var(--color-fg-muted)]")}>
          No stories in this lane today.
        </p>
      )}

      {hasLiveData && feedItems.length > 0 && (
        <>
          <SectionErrorBoundary section="Index strip">
            <IndexStrip items={feedItems} />
          </SectionErrorBoundary>

          {lead && (
            <SectionErrorBoundary section="Lead">
              {leadIsFallback && (
                <div className={GUTTER_X}>
                  <LeadEnrichmentWarning item={lead} />
                </div>
              )}
              <Lead item={lead} />
              {lead.sayThis && (
                <div className={cn(GUTTER_X, "rule-hair mt-8 pt-6")}>
                  <SayThis
                    sayThis={lead.sayThis}
                    actions={
                      lead.sourceUrl ? (
                        <a
                          href={lead.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bs-btn bs-btn-outline"
                        >
                          Read the original ↗
                        </a>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </SectionErrorBoundary>
          )}

          <SectionErrorBoundary section="Metrics">
            <WhereThingsStand />
          </SectionErrorBoundary>

          <SectionErrorBoundary section="More from today">
            <StoryColumns items={columns} />
          </SectionErrorBoundary>

          <SectionErrorBoundary section="Wire">
            <Wire items={wire} />
          </SectionErrorBoundary>
        </>
      )}

      {/* Demo mode with no DB: the curated seed, rendered through the same
          columns so the layout is honest about what it is. */}
      {!hasLiveData && isDemo && <SeedFallback />}

      <SubscribeBand source="today-band" />
    </>
  );
}

/**
 * Date pager, inline in the utility bar. The `?date=` param and the
 * getRecentDates walk are unchanged — only the placement moved.
 */
function DatePagerInline({
  date,
  isToday,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: {
  date: string;
  isToday: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <span className="inline-flex items-center gap-1.5 ml-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Previous day with stories"
        className="bs-link p-1 disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="bs-label tabular-nums" style={{ color: "var(--color-fg)" }}>
        {label}
        {isToday ? " · Today" : ""}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next day with stories"
        className="bs-link p-1 disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Bulk copy of the day's talking points. Moved from beside the date pager
 *  into the utility bar; the payload format is unchanged. */
function CopyTalkingPoints({
  items,
  date,
}: {
  items: Array<{ title: string; whyItMatters: string | null; sayThis: string | null }>;
  date: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    const lines: string[] = [`Talking points · The Desk · ${dateLabel}`, ""];
    items.forEach((item, i) => {
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
    <button type="button" onClick={copy} className="bs-label bs-link ml-2">
      {copied ? "Copied" : `Copy ${items.length} talking point${items.length === 1 ? "" : "s"}`}
    </button>
  );
}

/** Loading placeholder mirroring the new layout: index strip, lead block,
 *  three columns. */
function FeedSkeleton() {
  return (
    <div aria-busy="true">
      <div className={cn(GUTTER_X, "rule-hair-b grid lg:grid-cols-5 gap-5 py-4")}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className={cn(GUTTER_X, "grid lg:grid-cols-[minmax(0,1.68fr)_minmax(0,1fr)] gap-11 pt-8")}>
        <div className="space-y-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="aspect-video w-full rounded-none" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className={cn(GUTTER_X, "grid lg:grid-cols-3 gap-8 mt-11")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[3/2] w-full rounded-none" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Real-DB-but-empty Today state, restyled as a centred type block on
 * hairlines rather than a panel. Editor copy stays gated to admins so a
 * partner reader doesn't see GitHub Actions plumbing.
 */
function EmptyFeedState() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <div className={cn(GUTTER_X, "rule-hair rule-hair-b my-12 py-16 text-center")}>
      <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
        Today&apos;s feed
      </p>
      <h2 className="font-serif font-bold mt-3" style={{ fontSize: 40, lineHeight: 1.04 }}>
        The desk is quiet.
      </h2>
      <p className="mx-auto mt-4 max-w-[58ch] text-[var(--color-fg-muted)]">
        {isAdmin
          ? "The daily-feed workflow hasn't run yet today, or it was just wiped. Re-fire from GitHub Actions to repopulate."
          : "Today's brief hasn't landed yet. New stories arrive at 7am AEST on weekdays."}
      </p>
      {isAdmin && (
        <p className="bs-label mt-5" style={{ letterSpacing: "0.18em" }}>
          GitHub · Actions · Daily Feed · Run workflow
        </p>
      )}
    </div>
  );
}

/** Demo-mode seed fallback. Same curated stories as before, rendered as
 *  index rows so demo mode can't be mistaken for a live feed. */
function SeedFallback() {
  return (
    <section className={cn(GUTTER_X, "rule-major mt-8 pt-6")}>
      <p className="bs-label mb-5" style={{ letterSpacing: "0.24em" }}>
        Demo edition {editionMeta.number} · seed content
      </p>
      <div>
        {stories.map((s) => (
          <div key={s.id} className="rule-hair-b py-4">
            <p className="bs-label" style={{ letterSpacing: "0.16em" }}>
              {s.category}
            </p>
            <p
              className="font-serif mt-1.5"
              style={{ fontSize: 22, lineHeight: 1.24, letterSpacing: "-0.025em" }}
            >
              {s.headline}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
