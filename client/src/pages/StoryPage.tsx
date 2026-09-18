import { REVIEWED_STORY_CORRECTIONS } from "@shared/reviewedStoryCorrections";
import { contentRouteId } from "@shared/contentRouteId";
import { ConnectionNotice } from "@/components/ConnectionNotice";
import { ThreadLink } from "@/components/feed/ThreadLink";
import { sourceTimingLabel } from "@shared/sourceTiming";
import { GuideContext } from "@/components/GuideContext";
/**
 * Story — the surface a LinkedIn link lands on, so it has to convert a
 * stranger.
 *
 * A `1fr / 1px / 340px` grid under the shell's slim masthead. Main column:
 * breadcrumb, headline, dek, byline row bounded by hairlines, the 16:9
 * image, prose with the drop cap, Why-it-matters / Counterpoint as a
 * two-up, the full-measure Say This, then the three partner angles as
 * hairline-divided columns under a major rule, then the pager. Rail: the
 * cash-rate panel, the metric rows and "More from this day".
 *
 * The day-paging logic and the same-category-first ordering of the rail
 * are unchanged — only the presentation moved.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { LinkedInPostModal } from "@/components/LinkedInPostModal";
import { DeskTakeShareButton } from "@/components/share/DeskTakeShareButton";
import { StoryShareButton } from "@/components/share/StoryShareButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { CashRatePanel, MetricRows } from "@/components/broadsheet/MetricBlocks";
import { ReaderAngleColumns } from "@/components/broadsheet/ReaderAngles";
import { SayThis } from "@/components/broadsheet/SayThis";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { toast } from "sonner";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { useCategoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";
import { cleanHeadline, shouldShowSummary } from "@/lib/headline";
import { readingMinutes } from "@/lib/readingTime";
import { buildStoryShareDraft } from "@/lib/shareDraft";
import { markStoryRead } from "@/lib/useReadStories";
import { useBookmarks } from "@/lib/useBookmarks";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";

export default function StoryPage() {
  const params = useParams<{ id: string }>();
  const id = contentRouteId(params.id) ?? NaN;
  const [linkedInOpen, setLinkedInOpen] = useState(false);
  const colourFor = useCategoryColour();
  const { isBookmarked, toggle } = useBookmarks();

  const itemQuery = trpc.feed.getById.useQuery({ id }, { enabled: Number.isFinite(id) && id > 0 });

  const opened = useRef<number | null>(null);
  const story = itemQuery.data;
  // Failed/held/missing stories must stay unread. Refetches and StrictMode
  // effects are not another opening; leaving and returning is.
  useEffect(() => {
    if (!story || story.id !== id) return;
    markStoryRead(id);
    if (opened.current === id) return;
    opened.current = id;
    trackEvent("story_open", "story");
  }, [id, story]);

  // Pull the rest of the story's day so the page is never a dead-end: it
  // powers prev/next paging and the "More from this day" rail. Cheap — the day
  // is already cached from the Today page.
  const dayQuery = trpc.feed.getByDate.useQuery(
    { date: story?.feedDate ?? "" },
    { enabled: !!story?.feedDate, staleTime: 60_000 }
  );
  const day = dayQuery.data ?? [];
  const dayIdx = day.findIndex((s) => s.id === id);
  const prevStory = dayIdx > 0 ? (day[dayIdx - 1] ?? null) : null;
  const nextStory = dayIdx >= 0 && dayIdx < day.length - 1 ? (day[dayIdx + 1] ?? null) : null;
  const others = day.filter((s) => s.id !== id);
  const moreToday = [
    ...others.filter((s) => s.category === story?.category),
    ...others.filter((s) => s.category !== story?.category),
  ].slice(0, 4);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className={cn(GUTTER_X, "py-16")}>
        <p className="bs-label">Story</p>
        <h1 className="font-serif font-bold mt-3" style={{ fontSize: "2.5rem" }}>
          Invalid story id
        </h1>
        <Link href="/" className="bs-label bs-link mt-5 inline-block">
          ← Back to Today
        </Link>
      </div>
    );
  }

  if (itemQuery.isLoading) return <StorySkeleton />;
  if (itemQuery.isError && !story)
    return (
      <ConnectionNotice retry={() => void itemQuery.refetch()} retrying={itemQuery.isFetching} />
    );
  if (!story) {
    return (
      <div className={cn(GUTTER_X, "py-16")}>
        <h1 className="font-serif font-bold" style={{ fontSize: "2.5rem" }}>
          Story not found.
        </h1>
        <Link href="/" className="bs-label bs-link mt-5 inline-block">
          ← Back to Today
        </Link>
      </div>
    );
  }

  const correction = REVIEWED_STORY_CORRECTIONS.find(
    (c) => c.id === story.id && c.sourceUrl === story.sourceUrl
  );
  const correctionApplied = correction?.fields.every((field) => story[field.field] === field.after);
  const dek = shouldShowSummary(story.title, story.summary)
    ? dedash(story.summary)
    : story.whyItMatters
      ? dedash(story.whyItMatters)
      : null;
  const dekFromWhy = !shouldShowSummary(story.title, story.summary) && !!story.whyItMatters;
  const corroboration =
    story.corroborationCount && story.corroborationCount >= 2 && story.corroboratingSources?.length
      ? `, corroborated by ${story.corroboratingSources.slice(0, 2).join(" and ")}`
      : "";
  const saved = isBookmarked(String(story.id));
  const hasDeskTake = Boolean(
    story.rubensNote?.trim() || story.sayThis?.trim() || story.counterpoint?.trim()
  );

  return (
    <SectionErrorBoundary section="Story">
      <article className={cn(GUTTER_X, "grid lg:grid-cols-[minmax(0,1fr)_1px_340px]")}>
        <div className="pt-9 lg:pr-12 min-w-0">
          <p className="bs-label" style={{ letterSpacing: "0.22em" }}>
            <Link href="/" className="bs-link">
              Today
            </Link>
            <span className="mx-2">›</span>
            <span style={{ color: colourFor(story.category) }}>{story.category}</span>
            <span className="mx-2">›</span>
            Story
          </p>

          <h1
            className="font-serif font-bold mt-4 max-w-[26ch]"
            style={{
              fontSize: "clamp(2.125rem, 4.6vw, 3.75rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
              textWrap: "pretty",
            }}
          >
            {cleanHeadline(story.title)}
          </h1>

          {dek && (
            <p
              className="font-serif mt-5 max-w-[56ch]"
              style={{
                fontSize: "clamp(1.125rem, 1.8vw, 1.5rem)",
                lineHeight: 1.42,
                color: "var(--color-fg-muted)",
                textWrap: "pretty",
              }}
            >
              {dek}
            </p>
          )}

          <div className="mt-4">
            <ThreadLink parentId={story.threadParentId} parentTitle={story.threadParentTitle} />
          </div>

          {/* Byline row, bounded by hairlines above and below. */}
          <div className="rule-hair rule-hair-b mt-7 py-4 flex items-center gap-4 flex-wrap">
            <img
              src="/ruben.jpg"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover shrink-0"
              loading="lazy"
              decoding="async"
            />
            <div className="min-w-0">
              <p style={{ fontSize: "0.90625rem" }}>
                Briefing curated by <span className="font-semibold">Ruben Laubscher</span>
                {" · The Desk"}
              </p>
              <p className="bs-label mt-1" style={{ letterSpacing: "0.16em" }}>
                Briefing {story.feedDate} · {readingMinutes(story)} min read
                {story.source ? ` · source ${story.source}` : ""}
                {corroboration}
              </p>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                {sourceTimingLabel(story.sourceTiming)}
              </p>
            </div>
            <div className="ml-auto flex gap-2 shrink-0 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => toggle(String(story.id))}
                className="bs-btn bs-btn-outline"
                aria-pressed={saved}
              >
                {saved ? "Saved" : "Save"}
              </button>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="bs-btn bs-btn-outline">Share</button>
                </DialogTrigger>
                <DialogContent className="max-w-md w-[calc(100%_-_2rem)]">
                  <DialogTitle className="font-serif text-2xl">Share this story</DialogTitle>
                  <DialogDescription>{cleanHeadline(story.title)}</DialogDescription>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="bs-btn bs-btn-solid"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}/story/${story.id}`
                          );
                          toast.success("Story link copied");
                          trackEvent("story_share", "story");
                        } catch {
                          toast.error("Could not copy. Copy the address from your browser.");
                        }
                      }}
                    >
                      Copy link
                    </button>
                    {typeof navigator.share === "function" && (
                      <button
                        className="bs-btn bs-btn-outline"
                        onClick={() => {
                          void navigator
                            .share({
                              title: cleanHeadline(story.title),
                              url: `${window.location.origin}/story/${story.id}`,
                            })
                            .then(() => trackEvent("story_share", "story"))
                            .catch((error: Error) => {
                              if (error.name !== "AbortError")
                                toast.error("Sharing is unavailable. Try Copy link.");
                            });
                        }}
                      >
                        Share to…
                      </button>
                    )}
                    <StoryShareButton id={story.id} title={cleanHeadline(story.title)} />
                    {hasDeskTake && (
                      <DeskTakeShareButton id={story.id} title={cleanHeadline(story.title)} />
                    )}
                    <button className="bs-btn bs-btn-outline" onClick={() => setLinkedInOpen(true)}>
                      Prepare LinkedIn draft
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <aside
              aria-label="Review status"
              className="rule-hair py-4 text-sm leading-6 text-[var(--color-fg-muted)]"
            >
              <p className="bs-label-accent">Review status</p>
              <p className="mt-2">
                AI-assisted summary and interpretation. Automated source and numeric checks are
                safeguards, not human verification. Individual human pre-approval is not recorded
                here.
              </p>
              {correctionApplied && (
                <p className="mt-2">
                  A dated source correction applies to the displayed fields.{" "}
                  <a href="/corrections" className="bs-link underline">
                    Read what changed and the review limits.
                  </a>
                </p>
              )}
            </aside>
            {story.sourceUrl && /^https?:\/\//i.test(story.sourceUrl) ? (
              <a
                href={story.sourceUrl}
                onClick={() => trackEvent("story_source", "story")}
                target="_blank"
                rel="noopener noreferrer"
                className="bs-link min-h-11 inline-flex items-center underline"
              >
                Read original reporting{story.source ? ` at ${story.source}` : ""} ↗
              </a>
            ) : (
              <p className="text-[var(--color-fg-muted)]">Original reporting link unavailable.</p>
            )}
            <Link
              href={`/ask?story=${story.id}&q=${encodeURIComponent(`What does this story mean for property? ${cleanHeadline(story.title)}`.slice(0, 240))}`}
              onClick={() => trackEvent("story_ask", "story")}
              className="bs-btn bs-btn-outline"
            >
              Ask about this story
            </Link>
          </div>
          {correctionApplied && correction && (
            <p className="text-sm mt-5" role="note">
              Corrected{" "}
              {new Date(`${correction.issuedOn}T12:00:00Z`).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
              .{" "}
              <Link href="/corrections" className="bs-link">
                Read what changed →
              </Link>
            </p>
          )}
          <p className="bs-label mt-5">The Desk summary and interpretation</p>

          {/* Body prose with the existing `.has-dropcap` treatment.
              A feed item has no long-form body field — the publisher
              summary is the standfirst above — so the drop cap belongs to
              the editor's own note, which is the only block on this page
              that reads as written-through prose. Rendering the summary
              here as well would print the same paragraph twice. */}
          {story.rubensNote?.trim() && (
            <div className="has-dropcap mt-8 max-w-[66ch]">
              <p style={{ fontSize: "1.125rem", lineHeight: 1.72, color: "var(--color-fg-body)" }}>
                {dedash(story.rubensNote)}
              </p>
            </div>
          )}

          {((story.whyItMatters && !dekFromWhy) || story.counterpoint) && (
            <div className="rule-hair mt-6 pt-6 max-w-[66ch] flex flex-col sm:flex-row gap-6 sm:gap-7">
              {story.whyItMatters && !dekFromWhy && (
                <div className="flex-1 min-w-0">
                  <p className="bs-label">Why it matters</p>
                  <p
                    className="mt-2"
                    style={{
                      fontSize: "1.03125rem",
                      lineHeight: 1.6,
                      color: "var(--color-fg-body)",
                    }}
                  >
                    {dedash(story.whyItMatters)}
                  </p>
                </div>
              )}
              {story.whyItMatters && !dekFromWhy && story.counterpoint && (
                <div
                  className="hidden sm:block w-px shrink-0"
                  style={{ background: "var(--color-border)" }}
                  aria-hidden="true"
                />
              )}
              {story.counterpoint && (
                <div className="flex-1 min-w-0">
                  <p className="bs-label">The counterpoint</p>
                  <p
                    className="mt-2"
                    style={{
                      fontSize: "1.03125rem",
                      lineHeight: 1.6,
                      color: "var(--color-fg-body)",
                    }}
                  >
                    {dedash(story.counterpoint)}
                  </p>
                </div>
              )}
            </div>
          )}

          {story.sayThis && (
            <SayThis sayThis={story.sayThis} size={33} className="mt-8 max-w-[64ch]" />
          )}

          <ReaderAngleColumns raw={story.partnerTag} className="mt-9" />
          <GuideContext title={story.title} channel={story.channel} />

          {(prevStory || nextStory) && (
            <nav
              className="rule-hair mt-9 pt-5 grid sm:grid-cols-[1fr_1px_1fr] gap-y-5"
              aria-label="Step through today's stories"
            >
              <StoryStep item={prevStory} direction="prev" />
              <div
                className="hidden sm:block"
                style={{ background: "var(--color-border)" }}
                aria-hidden="true"
              />
              <StoryStep item={nextStory} direction="next" />
            </nav>
          )}
        </div>

        <div
          className="hidden lg:block"
          style={{ background: "var(--color-border)" }}
          aria-hidden="true"
        />

        {/* Rail */}
        <aside className="pt-9 lg:pl-10 min-w-0">
          <p className="bs-label" style={{ letterSpacing: "0.24em" }}>
            Where things stand
          </p>
          <CashRatePanel compact showAllLink={false} />
          <MetricRows />

          {moreToday.length > 0 && (
            <>
              <p className="bs-label mt-8" style={{ letterSpacing: "0.24em" }}>
                More from this day
              </p>
              <div className="mt-3.5">
                {moreToday.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/story/${s.id}`}
                    className={cn(
                      "bs-row rule-hair block py-3.5",
                      i === moreToday.length - 1 && "rule-hair-b"
                    )}
                  >
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: "0.75rem",
                        letterSpacing: "0.16em",
                        color: colourFor(s.category),
                      }}
                    >
                      {s.category}
                      {s.source ? ` · ${s.source}` : ""}
                    </span>
                    <p
                      className="font-serif mt-1.5"
                      style={{ fontSize: "1.125rem", lineHeight: 1.28, letterSpacing: "-0.02em" }}
                    >
                      {cleanHeadline(s.title)}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </aside>
      </article>

      <LinkedInPostModal
        open={linkedInOpen}
        onOpenChange={setLinkedInOpen}
        initialText={buildStoryShareDraft(story)}
      />

      <SubscribeBand
        source="story-foot"
        headline="Understand what changed in Australian property."
        blurb=""
        showHeadshot={false}
      />
    </SectionErrorBoundary>
  );
}

/**
 * Prev/next pager cell. Renders an empty placeholder when there's no
 * neighbour so the two-up stays balanced and "next" always sits right.
 */
function StoryStep({
  item,
  direction,
}: {
  item: DailyFeedItem | null;
  direction: "prev" | "next";
}) {
  if (!item) return <span className="hidden sm:block" aria-hidden="true" />;
  const isNext = direction === "next";
  return (
    <Link
      href={`/story/${item.id}`}
      className={cn("bs-link block", isNext ? "sm:pl-6 sm:text-right" : "sm:pr-6")}
    >
      <p className="bs-label">{isNext ? "Next →" : "← Previous"}</p>
      <p
        className="font-serif mt-2"
        style={{ fontSize: "1.25rem", lineHeight: 1.28, letterSpacing: "-0.02em" }}
      >
        {cleanHeadline(item.title)}
      </p>
    </Link>
  );
}

function StorySkeleton() {
  return (
    <div
      className={cn(GUTTER_X, "grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 pt-9")}
      aria-busy="true"
    >
      <div className="space-y-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-12 w-3/5" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="aspect-video w-full rounded-none" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
