/**
 * Card for a single daily feed item. Composed from PartnerTagBlock,
 * SayThisLine, and a "save to queue" action that uses optimistic updates
 * (improvement #10).
 */
import { useState } from "react";
import { ArrowRight, Bookmark, BookmarkCheck, ChevronDown, ExternalLink, Pin, PinOff, Trash2 } from "lucide-react";
import { Linkedin } from "@/components/icons/BrandIcons";
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

export function FeedItemCard({
  item,
  wide = false,
}: {
  item: DailyFeedItem;
  /** Lone-in-its-row card: span the full width and lay the editorial column
   *  and the "Ruben's read" side by side, with the read expanded, so a single
   *  trailing story fills the row instead of stranding empty columns. */
  wide?: boolean;
}) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [linkedInOpen, setLinkedInOpen] = useState(false);
  // Grid cards are a scan, not the full read: the lead and the story page
  // carry the broadsheet treatment, so here the deeper editorial blocks
  // (why it matters / counterpoint / Say This / partner angles) collapse
  // behind a toggle. Without this every grid card inherited the lead's full
  // height and a 3-up column became a skyscraper of scroll.
  const [showAnalysis, setShowAnalysis] = useState(false);

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

  // The analytical blocks that hang below the action row. When the dek was
  // empty the take is promoted up to fill the dek slot, so it's NOT part of
  // the collapsible (it's the card's only body copy and stays visible).
  const sayThisInPanel = Boolean(dek && !item.rubensNote && item.sayThis);
  const hasAnalysis = Boolean(
    (item.whyItMatters && dek?.from !== "whyItMatters") ||
      (item.counterpoint && dek?.from !== "counterpoint") ||
      (dek && (item.rubensNote || item.sayThis)) ||
      item.partnerTag
  );
  // A short hint at what's inside the collapsed read, so the toggle still
  // advertises the signature Say This / partner-angle value.
  const analysisHint = sayThisInPanel
    ? " · Say This + angles"
    : item.partnerTag
      ? " · Partner angles"
      : "";

  // The analytical blocks, shared between the collapsible (normal grid card)
  // and the always-expanded right column (wide card).
  const analysisBlocks = (
    <>
      {item.whyItMatters && dek?.from !== "whyItMatters" && (
        <WhyItMattersLine
          whyItMatters={item.whyItMatters}
          category={item.category}
        />
      )}
      {item.counterpoint && dek?.from !== "counterpoint" && (
        <CounterpointLine counterpoint={item.counterpoint} />
      )}
      {/* RubensNote overrides the Say This line when present. */}
      {dek && (
        <>
          <RubensNoteBlock itemId={item.id} note={item.rubensNote} />
          {!item.rubensNote && item.sayThis && (
            <SayThisLine sayThis={item.sayThis} category={item.category} />
          )}
        </>
      )}
      {item.partnerTag && <PartnerTagBlock raw={item.partnerTag} />}
    </>
  );

  return (
    <Card
      panelHover
      lift
      revealOnHover
      padding="none"
      clip
      accentClass={categoryAccentClass(item.category)}
    >
      {/* Photo plate — only when there's a real og:image. A story with no
          image renders as a clean text card (metadata → headline → dek)
          rather than a tall empty 16:9 box with a stranded category word,
          which read as a broken/missing image. */}
      {item.imageUrl && (
        <Link
          href={`/story/${item.id}`}
          className="group/thumb relative block w-full overflow-hidden"
          style={{ aspectRatio: "16 / 9" }}
        >
          <img
            src={item.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover/thumb:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
          <span
            className="absolute inset-0 noise-overlay pointer-events-none"
            style={{ opacity: 0.4 }}
            aria-hidden="true"
          />
        </Link>
      )}

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

      {/* Body. On a lone full-width card (`wide`) the editorial column and the
          analytical "Ruben's read" sit side by side at lg to fill the row, with
          the read expanded; in the normal grid they stack and the read
          collapses behind a toggle. */}
      <div className={wide ? "lg:grid lg:grid-cols-2 lg:gap-x-10 lg:items-start" : undefined}>
        <div>
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

          {/* Lede. Clamped to keep grid rows visually uniform. When the story
              has no proper dek the editorial take is promoted up to fill the
              slot; the "below" Say This render is then skipped to avoid
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

          {/* Action row. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
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
        </div>

        {/* Ruben's read. Wide card: always expanded in a side column. Normal
            grid card: collapses behind a toggle so the grid stays a scan. */}
        {hasAnalysis &&
          (wide ? (
            <div className="mt-5 pt-5 border-t border-[var(--color-border)] lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-10">
              <p
                className="overline text-[var(--color-fg-subtle)] mb-3"
                style={{ letterSpacing: "0.18em" }}
              >
                Ruben&apos;s read{analysisHint}
              </p>
              {analysisBlocks}
            </div>
          ) : showAnalysis ? (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowAnalysis(false)}
                aria-expanded="true"
                className="inline-flex items-center gap-1.5 overline text-[var(--color-fg-subtle)] hover:text-amber-200 transition-colors mb-1"
                style={{ letterSpacing: "0.18em" }}
              >
                Ruben&apos;s read
                <ChevronDown className="h-3 w-3 rotate-180 transition-transform" />
              </button>
              {analysisBlocks}
            </div>
          ) : (
            <button
              onClick={() => setShowAnalysis(true)}
              aria-expanded="false"
              className="mt-4 pt-4 border-t border-[var(--color-border)] w-full inline-flex items-center justify-between gap-2 overline text-[var(--color-fg-subtle)] hover:text-amber-200 transition-colors"
              style={{ letterSpacing: "0.18em" }}
            >
              <span>Ruben&apos;s read{analysisHint}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>

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
