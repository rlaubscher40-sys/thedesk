/**
 * Expanded view of a single feed item. Same content as the card, just laid
 * out to read.
 */
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Linkedin } from "lucide-react";
import { Link, useParams } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { LinkedInPostModal } from "@/components/LinkedInPostModal";
import { SubscribeCallout } from "@/components/SubscribeCallout";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PartnerTagBlock } from "@/components/feed/PartnerTagBlock";
import { SayThisLine } from "@/components/feed/SayThisLine";
import { WhyItMattersLine } from "@/components/feed/WhyItMattersLine";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cleanHeadline, shouldShowSummary } from "@/lib/headline";
import { cn } from "@/lib/cn";
import { SITE_DISPLAY } from "@/lib/siteUrl";
import { trpc } from "@/lib/trpc";

export default function StoryPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  const itemQuery = trpc.feed.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) && id > 0 }
  );

  // Pull the rest of the story's day so the page is never a dead-end: it
  // powers prev/next paging through the day and a "More from today" rail,
  // keeping a reader inside The Desk instead of bouncing out via "Read
  // original". Cheap — the day is already cached from the Today page.
  const story = itemQuery.data;
  const dayQuery = trpc.feed.getByDate.useQuery(
    { date: story?.feedDate ?? "" },
    { enabled: !!story?.feedDate, staleTime: 60_000 }
  );
  const day = dayQuery.data ?? [];
  const dayIdx = day.findIndex((s) => s.id === id);
  const prevStory = dayIdx > 0 ? day[dayIdx - 1] ?? null : null;
  const nextStory =
    dayIdx >= 0 && dayIdx < day.length - 1 ? day[dayIdx + 1] ?? null : null;
  // Related: same category first (most relevant), then fill from the rest of
  // the day, capped so the rail stays a glance, not a second feed.
  const others = day.filter((s) => s.id !== id);
  const moreToday = [
    ...others.filter((s) => s.category === story?.category),
    ...others.filter((s) => s.category !== story?.category),
  ].slice(0, 4);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div>
        <PageHeader overline="Story" title="Invalid story id" />
        <BackLink />
      </div>
    );
  }

  return (
    <article className={cn("max-w-3xl mx-auto", itemQuery.data && categoryAccentClass(itemQuery.data.category))}>
      <BackLink />
      <SectionErrorBoundary section="Story">
        {itemQuery.isLoading ? (
          <StorySkeleton />
        ) : !itemQuery.data ? (
          <p className="text-sm text-[var(--color-fg-muted)] mt-6">Story not found.</p>
        ) : (
          <>
            <header className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="overline" style={{ color: "var(--color-amber)" }}>
                  {itemQuery.data.category}
                </span>
                <span className="overline">{itemQuery.data.source}</span>
                <span className="overline">{itemQuery.data.feedDate}</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{cleanHeadline(itemQuery.data.title)}</h1>
            </header>

            {/* Real summary as the lede; if there's none (Google-News
                headline-echo), the "why it matters" stands in so the page is
                never blank, and the labelled block below is skipped. */}
            {shouldShowSummary(itemQuery.data.title, itemQuery.data.summary) ? (
              <p className="text-base leading-relaxed mt-6 text-[var(--color-fg)]">
                {itemQuery.data.summary}
              </p>
            ) : itemQuery.data.whyItMatters ? (
              <p className="text-base leading-relaxed mt-6 text-[var(--color-fg)]">
                {itemQuery.data.whyItMatters}
              </p>
            ) : null}

            <div className="flex items-center gap-2 mt-5">
              {itemQuery.data.sourceUrl && (
                <a
                  href={itemQuery.data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-amber-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Read original
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => setLinkedInOpen(true)}>
                <Linkedin className="h-3.5 w-3.5" /> Share to LinkedIn
              </Button>
            </div>

            {itemQuery.data.whyItMatters &&
              shouldShowSummary(itemQuery.data.title, itemQuery.data.summary) && (
                <WhyItMattersLine
                  whyItMatters={itemQuery.data.whyItMatters}
                  category={itemQuery.data.category}
                />
              )}
            {itemQuery.data.sayThis && (
              <SayThisLine sayThis={itemQuery.data.sayThis} category={itemQuery.data.category} />
            )}
            <PartnerTagBlock raw={itemQuery.data.partnerTag} />

            <LinkedInPostModal
              open={linkedInOpen}
              onOpenChange={setLinkedInOpen}
              initialText={[
                cleanHeadline(itemQuery.data.title),
                "",
                shouldShowSummary(itemQuery.data.title, itemQuery.data.summary)
                  ? itemQuery.data.summary
                  : "",
                itemQuery.data.sayThis ? `\nMy take: ${itemQuery.data.sayThis}` : "",
                "",
                `Via The Desk · ${SITE_DISPLAY}`,
              ]
                .join("\n")
                .trim()}
            />

            {/* Onward navigation — no dead-ends. Step through the day, then a
                short "More from today" rail, both before the outbound
                Subscribe panel so the reader's next move stays in The Desk. */}
            {(prevStory || nextStory) && (
              <nav
                className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3"
                aria-label="Step through today's stories"
              >
                <StoryStep item={prevStory} direction="prev" />
                <StoryStep item={nextStory} direction="next" />
              </nav>
            )}

            {moreToday.length > 0 && (
              <section className="mt-10">
                <div className="flex items-baseline gap-4 mb-4">
                  <span
                    className="font-mono uppercase tracking-[0.24em] shrink-0 text-[var(--color-fg-subtle)]"
                    style={{ fontSize: "10px" }}
                  >
                    More from today
                  </span>
                  <span className="block flex-1 h-px bg-[var(--color-border)]" aria-hidden="true" />
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {moreToday.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/story/${s.id}`}
                        className="group flex items-start gap-3 py-3 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-sm"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: categoryColour(s.category) }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className="font-mono uppercase tracking-[0.16em] block"
                            style={{ fontSize: "10px", color: categoryColour(s.category) }}
                          >
                            {s.category}
                          </span>
                          <span className="font-serif leading-snug text-[var(--color-fg)] group-hover:text-amber-200 transition-colors">
                            {cleanHeadline(s.title)}
                          </span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 mt-1 shrink-0 text-[var(--color-fg-subtle)] group-hover:text-amber-300 transition-colors" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* End-of-read Subscribe panel. Compact variant, story pages
                are shorter reads than editions. */}
            <div className="mt-12">
              <SubscribeCallout source="story-foot" variant="story" />
            </div>
          </>
        )}
      </SectionErrorBoundary>
    </article>
  );
}

/**
 * Prev/next pager tile. Renders an empty placeholder when there's no
 * neighbour in that direction so the two-up grid stays balanced (the
 * "next" tile always sits on the right). The "next" tile right-aligns its
 * content so the pair reads as ← previous / next →.
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
      className={cn(
        "panel panel-hover rounded-sm p-4 flex items-center gap-3 group",
        isNext && "sm:text-right sm:flex-row-reverse"
      )}
    >
      {isNext ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] group-hover:text-amber-300 transition-colors" />
      ) : (
        <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] group-hover:text-amber-300 transition-colors" />
      )}
      <span className="min-w-0">
        <span className="overline block text-[var(--color-fg-subtle)]">
          {isNext ? "Next" : "Previous"}
        </span>
        <span className="text-sm leading-snug line-clamp-2 text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
          {cleanHeadline(item.title)}
        </span>
      </span>
    </Link>
  );
}

function BackLink() {
  return (
    <Link href="/" className="overline inline-flex items-center gap-1.5 hover:text-amber-300">
      <ArrowLeft className="h-3 w-3" /> Back to Today
    </Link>
  );
}

function StorySkeleton() {
  return (
    <div className="space-y-3 mt-6" aria-busy="true">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}
