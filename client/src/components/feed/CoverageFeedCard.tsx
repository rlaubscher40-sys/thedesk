/**
 * Dense card used on the coverage lanes (Business, Tech & Science, Global).
 *
 * Those channels skip the LLM enrichment (see ENRICHED_CHANNELS in
 * shared/const), so the broadsheet treatment used by FeedItemCard — Playfair
 * headline, full action row, angle blocks — over-promises and under-delivers:
 * a giant card carrying a single RSS sentence. This variant matches the form
 * to the content tier — sans headline, ~⅓ the height — so the lane reads as
 * a scan instead of a string of unfilled deep-dives. Reserve the broadsheet
 * card for the enriched lanes where it has something to carry.
 */
import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Trash2 } from "lucide-react";
import { Linkedin } from "@/components/icons/BrandIcons";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cleanHeadline } from "@/lib/headline";
import { cardDek } from "@/lib/cardDek";
import { buildStoryShareDraft } from "@/lib/shareDraft";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "../ui/Card";
import { LinkedInPostModal } from "../LinkedInPostModal";
import { CorroborationBadge } from "./CorroborationBadge";
import { SourceFavicon } from "./SourceFavicon";

export function CoverageFeedCard({ item }: { item: DailyFeedItem }) {
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

  const isInQueue = trpc.readingQueue.list.useQuery(undefined, { enabled: isAuthenticated });
  const inQueueId = isInQueue.data?.find((q) => q.feedItemId === item.id)?.id;

  // Optimistic queue add/remove, same contract as FeedItemCard so the
  // reading-queue UI updates instantly on this dense surface too.
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
  const dek = cardDek(item);
  const catColour = categoryColour(item.category as never);

  return (
    <Card
      panelHover
      lift
      revealOnHover
      padding="sm"
      accentClass={categoryAccentClass(item.category)}
      className="flex flex-col gap-2"
    >
      {/* Meta row: coloured category dot + category + source. Action buttons
          on the right reveal on hover, matching FeedItemCard's UX. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 overline">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: catColour }}
            aria-hidden="true"
          />
          <span
            className="shrink-0"
            style={{ color: catColour, letterSpacing: "0.18em" }}
          >
            {item.category}
          </span>
          <span className="shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true">
            ·
          </span>
          <SourceFavicon url={item.sourceUrl} name={item.source} size={12} />
          <span className="truncate text-[var(--color-fg-subtle)]">{item.source}</span>
          <CorroborationBadge
            count={item.corroborationCount}
            sources={item.corroboratingSources}
          />
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 -mt-1 reveal-target">
          <button
            onClick={toggleQueue}
            aria-label={inQueueId ? "Remove from queue" : "Save to queue"}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
          >
            {inQueueId ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setLinkedInOpen(true)}
            aria-label="Share to LinkedIn"
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
          >
            <Linkedin className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              aria-label="Delete story (admin)"
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Headline — sans semibold, deliberately not display-3/Playfair. The
          serif treatment is reserved for the enriched lanes so the visual
          hierarchy reads at a glance: broadsheet = flagship, sans = scan. */}
      <Link href={`/story/${item.id}`} className="block group">
        <h3 className="text-[15px] sm:text-base font-semibold leading-snug tracking-[-0.005em] text-[var(--color-fg)] group-hover:text-amber-200 transition-colors">
          {title}
        </h3>
      </Link>

      {/* Dek clamped to 2 lines — coverage cards live in a 3-up grid and
          summaries arrive at very different lengths from publisher RSS, so
          a tighter clamp keeps the row rhythm even. */}
      {dek && (
        <p className="text-[13px] text-[var(--color-fg-muted)] leading-relaxed line-clamp-2">
          {dek.text}
        </p>
      )}

      {/* Single footer action: jump to the source. "Read more" / story-page
          jump is handled by the headline itself, so the footer stays a
          one-liner instead of FeedItemCard's wrapping action row. */}
      {item.sourceUrl && (
        <div className="mt-1">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Read original
          </a>
        </div>
      )}

      <LinkedInPostModal
        open={linkedInOpen}
        onOpenChange={setLinkedInOpen}
        initialText={buildStoryShareDraft(item)}
        heading="Share this story on LinkedIn"
      />
    </Card>
  );
}
