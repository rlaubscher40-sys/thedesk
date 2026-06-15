/**
 * Card for a single daily feed item. Composed from PartnerTagBlock,
 * SayThisLine, and a "save to queue" action that uses optimistic updates
 * (improvement #10).
 */
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Linkedin,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cleanHeadline, shouldShowSummary } from "@/lib/headline";
import { cardDek } from "@/lib/cardDek";
import { readingMinutes } from "@/lib/readingTime";
import { SITE_DISPLAY } from "@/lib/siteUrl";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LinkedInPostModal } from "../LinkedInPostModal";
import { PartnerTagBlock } from "./PartnerTagBlock";
import { RubensNoteBlock } from "./RubensNoteBlock";
import { SayThisLine } from "./SayThisLine";
import { WhyItMattersLine } from "./WhyItMattersLine";
import { CounterpointLine } from "./CounterpointLine";
import { CorroborationBadge } from "./CorroborationBadge";
import { SourceFavicon } from "./SourceFavicon";
import { ThreadLink } from "./ThreadLink";

export function FeedItemCard({ item }: { item: DailyFeedItem }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  const deleteItem = trpc.feed.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Story removed");
      utils.feed.getByDate.invalidate();
    },
    onError: () => toast.error("Couldn't delete that one"),
  });

  function handleDelete() {
    if (!confirm(`Remove "${item.title.slice(0, 60)}…" from today's feed?`)) return;
    deleteItem.mutate({ id: item.id });
  }

  // Admin priority toggle: pin a non-lead item to 100 and it becomes the
  // new Today lead on next refresh.
  const isPinned = (item.priority ?? 50) >= 100;
  const setPriority = trpc.feed.setPriority.useMutation({
    onSuccess: () => {
      utils.feed.getByDate.invalidate();
      toast.success(isPinned ? "Unpinned" : "Pinned as lead");
    },
    onError: () => toast.error("Couldn't update priority"),
  });

  const isInQueue = trpc.readingQueue.list.useQuery(undefined, { enabled: isAuthenticated });
  const inQueueId = isInQueue.data?.find((q) => q.feedItemId === item.id)?.id;

  // ── Optimistic add/remove on the reading queue (improvement #10) ──
  const add = trpc.readingQueue.add.useMutation({
    onMutate: async () => {
      await utils.readingQueue.list.cancel();
      const previous = utils.readingQueue.list.getData();
      utils.readingQueue.list.setData(undefined, (old) =>
        old
          ? [
              {
                id: -Date.now(),
                userId: 0,
                feedItemId: item.id,
                customUrl: null,
                customTitle: null,
                articleText: null,
                isRead: false,
                createdAt: new Date(),
                feedTitle: item.title,
                feedSummary: item.summary,
                feedCategory: item.category,
                feedSource: item.source,
                feedSourceUrl: item.sourceUrl,
                feedDate: item.feedDate,
                nudgeSentAt: null,
                nudgeResponse: null,
              },
              ...old,
            ]
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.readingQueue.list.setData(undefined, ctx.previous);
      toast.error("Could not save to queue");
    },
    onSettled: () => {
      utils.readingQueue.list.invalidate();
      utils.readingQueue.unreadCount.invalidate();
    },
  });

  const remove = trpc.readingQueue.remove.useMutation({
    onMutate: async ({ id }) => {
      await utils.readingQueue.list.cancel();
      const previous = utils.readingQueue.list.getData();
      utils.readingQueue.list.setData(undefined, (old) => old?.filter((q) => q.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.readingQueue.list.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      utils.readingQueue.list.invalidate();
      utils.readingQueue.unreadCount.invalidate();
    },
  });

  function toggleQueue() {
    if (!isAuthenticated) {
      toast.message("Sign in to save items");
      return;
    }
    if (inQueueId) remove.mutate({ id: inQueueId });
    else add.mutate({ feedItemId: item.id });
  }

  const title = cleanHeadline(item.title);
  // The dek under the headline: a real summary, or — for Google-News items that
  // have none — the best available enrichment line, so the card is never blank.
  // Whichever block it's taken from is hidden below so it isn't shown twice.
  const dek = cardDek(item);
  const linkedInDraft = buildLinkedInDraft(item);

  return (
    <Card
      panelHover
      lift
      revealOnHover
      padding="none"
      clip
      accentClass={categoryAccentClass(item.category)}
    >
      {/* Thumbnail plate. Image-forward grid (Discover / Apple News): the
          og:image fills a 16:9 plate when scraped; otherwise a category-tinted
          gradient keeps every card the same shape so the grid reads as
          intentional rather than ragged. Decorative — the headline below is
          the real tap target — so it's aria-hidden when there's no photo. */}
      <Link
        href={`/story/${item.id}`}
        className="group/thumb relative block w-full overflow-hidden"
        style={{
          aspectRatio: "16 / 9",
          // Size the watermark below against the CARD width, not the viewport,
          // so it can't overflow when the grid column narrows (e.g. beside the
          // wide-screen rail).
          containerType: "inline-size",
          background: `
            radial-gradient(circle at 78% 22%, ${categoryColour(item.category)}45 0%, transparent 55%),
            radial-gradient(circle at 14% 86%, ${categoryColour(item.category)}18 0%, transparent 55%),
            var(--grad-panel-soft)
          `,
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover/thumb:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className="absolute font-serif font-bold pointer-events-none select-none whitespace-nowrap"
            style={{
              top: "10%",
              left: "6%",
              right: "6%",
              color: categoryColour(item.category),
              opacity: 0.16,
              // Container-relative: 14cqw keeps even the longest enriched-lane
              // category (ECONOMICS / PROPERTY) inside the plate at any column
              // width, while still reading as a bold broadsheet watermark.
              fontSize: "clamp(22px, 14cqw, 60px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              mixBlendMode: "screen",
            }}
          >
            {item.category}
          </span>
        )}
        <span
          className="absolute inset-0 noise-overlay pointer-events-none"
          style={{ opacity: 0.4 }}
          aria-hidden="true"
        />
      </Link>

      <div className="p-6 sm:p-7">
      {/* Metadata bar, category in colour, source + actions on the right. */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="overline shrink-0"
            style={{ color: categoryColour(item.category), letterSpacing: "0.2em" }}
          >
            {item.category}
          </span>
          <span
            className="overline shrink-0 text-[var(--color-fg-subtle)]"
            aria-hidden="true"
          >
            ·
          </span>
          <SourceFavicon url={item.sourceUrl} name={item.source} />
          <span className="overline truncate">{item.source}</span>
          <CorroborationBadge
            count={item.corroborationCount}
            sources={item.corroboratingSources}
          />
          <span className="overline shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true">
            ·
          </span>
          <span className="overline shrink-0 text-[var(--color-fg-subtle)] tabular-nums">
            {readingMinutes(item)} min
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 -mr-1.5 reveal-target">
          <button
            onClick={toggleQueue}
            aria-label={inQueueId ? "Remove from queue" : "Save to queue"}
            className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
          >
            {inQueueId ? (
              <BookmarkCheck
                key="saved"
                className="h-4 w-4 text-amber-400 bookmark-pop"
              />
            ) : (
              <Bookmark key="empty" className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setLinkedInOpen(true)}
            aria-label="Share to LinkedIn"
            className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
          >
            <Linkedin className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() =>
                setPriority.mutate({
                  id: item.id,
                  priority: isPinned ? 50 : 100,
                })
              }
              disabled={setPriority.isPending}
              aria-label={isPinned ? "Unpin from lead" : "Pin as lead"}
              title={
                isPinned
                  ? "Unpin (let category priority decide order)"
                  : "Pin this story as the Today lead"
              }
              className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              {isPinned ? (
                <PinOff className="h-4 w-4 text-amber-400" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              aria-label="Delete story (admin)"
              title="Delete story (admin only)"
              className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Headline, display-3 serif, hover shifts to amber. */}
      <Link href={`/story/${item.id}`} className="block group">
        <h3 className="display-3 mb-3 group-hover:text-amber-200 transition-colors">
          {title}
        </h3>
      </Link>

      {/* Storyline spine: link back to the prior coverage this continues. */}
      {item.threadParentId && (
        <div className="mb-3 -mt-1">
          <ThreadLink
            parentId={item.threadParentId}
            parentTitle={item.threadParentTitle}
          />
        </div>
      )}

      {/* Lede. Clamped to keep grid rows visually uniform, summaries
          arrive at wildly different lengths from the LLM enrichment,
          and an uncapped paragraph blows the row height. The full
          summary still surfaces on the story page.

          When the story has no proper dek content, the editorial take
          is promoted up to fill the slot — labelled Say This / Ruben's
          note instead of a hole between the headline and the action
          row. The "below" Say This render is then skipped to avoid
          duplication. */}
      {dek ? (
        <p className="text-base text-[var(--color-fg-muted)] leading-relaxed line-clamp-3">
          {dek.text}
        </p>
      ) : item.rubensNote || item.sayThis ? (
        <>
          <RubensNoteBlock itemId={item.id} note={item.rubensNote} />
          {!item.rubensNote && item.sayThis && (
            <SayThisLine sayThis={item.sayThis} category={item.category} />
          )}
        </>
      ) : null}

      {/* Action row. Grouped so "Read more", "Read original" and the admin
          "Add note" affordance wrap cleanly instead of crowding into each
          other on a single line. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
        {/* The summary clamps to 3 lines, so signal that the full read
            lives on the story page rather than leaving the truncation
            ambiguous. Distinct from "Read original" below, which leaves
            the site for the source. */}
        <Link
          href={`/story/${item.id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-subtle)] hover:text-amber-200 transition-colors"
        >
          Read more
          <ArrowRight className="h-3 w-3" />
        </Link>

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Read original
          </a>
        )}
      </div>

      {/* "Why it matters" — analytical context, shown whenever present and
          independent of the partner-angle pairing. It's the so-what that
          lets a reader grasp the stakes in one scan. */}
      {item.whyItMatters && dek?.from !== "whyItMatters" && (
        <WhyItMattersLine whyItMatters={item.whyItMatters} category={item.category} />
      )}

      {/* Counterpoint — the contrarian read, present only when the story has
          a genuine second side. Independent of the partner-angle pairing. */}
      {item.counterpoint && dek?.from !== "counterpoint" && (
        <CounterpointLine counterpoint={item.counterpoint} />
      )}

      {/* Say This and Partner Angles render independently — a story can
          carry either one. RubensNote is an editorial override that takes
          the place of the Say This line when present. Skipped when there
          was no dek and the take was already promoted up to fill the dek
          slot above, otherwise the same line would render twice. */}
      {dek && (
        <>
          <RubensNoteBlock itemId={item.id} note={item.rubensNote} />
          {!item.rubensNote && item.sayThis && (
            <SayThisLine sayThis={item.sayThis} category={item.category} />
          )}
        </>
      )}

      {item.partnerTag && <PartnerTagBlock raw={item.partnerTag} />}

      <LinkedInPostModal
        open={linkedInOpen}
        onOpenChange={setLinkedInOpen}
        initialText={linkedInDraft}
        heading="Share this story on LinkedIn"
      />
      </div>
    </Card>
  );
}

function buildLinkedInDraft(item: DailyFeedItem): string {
  const lines = [
    cleanHeadline(item.title),
    "",
    shouldShowSummary(item.title, item.summary) ? item.summary : "",
    item.sayThis ? `\nMy take: ${item.sayThis}` : "",
    "",
    `Via The Desk · ${SITE_DISPLAY}`,
  ];
  return lines.filter((l) => l !== "" || true).join("\n").trim();
}
