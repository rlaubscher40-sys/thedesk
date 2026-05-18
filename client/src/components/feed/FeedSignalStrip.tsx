/**
 * Compact horizontal strip for "Further signals" — stories that landed
 * in the daily feed for awareness but didn't earn the full Say This /
 * Partner Angles treatment, plus any angle-bearing leftovers that
 * couldn't fit a complete grid row.
 *
 * Layout: single-column text strip with category-accent left edge.
 * No thumbnail — at the strip's height the thumbnails created
 * inconsistent vertical gaps (image natural aspect ratios pulled
 * the row taller than text-only rows). Tighter padding than the grid
 * cards, no angle blocks. Visually demoted relative to FeedItemCard
 * so the eye treats them as supporting context.
 */
import { Bookmark, BookmarkCheck, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export function FeedSignalStrip({ item }: { item: DailyFeedItem }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const queueQuery = trpc.readingQueue.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const inQueueId = queueQuery.data?.find((q) => q.feedItemId === item.id)?.id;

  const add = trpc.readingQueue.add.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });
  const remove = trpc.readingQueue.remove.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });
  const deleteItem = trpc.feed.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Story removed");
      utils.feed.getByDate.invalidate();
    },
    onError: () => toast.error("Couldn't delete that one"),
  });

  function toggleQueue() {
    if (!isAuthenticated) {
      toast.message("Sign in to save items");
      return;
    }
    if (inQueueId) remove.mutate({ id: inQueueId });
    else add.mutate({ feedItemId: item.id });
  }

  function handleDelete() {
    if (!confirm(`Remove "${item.title.slice(0, 60)}…" from today's feed?`))
      return;
    deleteItem.mutate({ id: item.id });
  }

  return (
    <article
      className={cn(
        "panel hover-lift rounded-sm overflow-hidden",
        categoryAccentClass(item.category)
      )}
    >
      <div className="p-4 sm:p-5 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 overline truncate min-w-0">
            <span
              className="overline-amber shrink-0"
              style={{
                color: categoryColour(item.category),
                letterSpacing: "0.2em",
              }}
            >
              {item.category}
            </span>
            <span
              className="shrink-0 text-[var(--color-fg-subtle)]"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="truncate text-[var(--color-fg-subtle)]">
              {item.source}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
            <button
              onClick={toggleQueue}
              aria-label={inQueueId ? "Remove from queue" : "Save to queue"}
              className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
            >
              {inQueueId ? (
                <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                aria-label="Delete story (admin)"
                title="Delete story (admin only)"
                className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <Link href={`/story/${item.id}`} className="block group">
          <h3 className="font-serif font-bold text-base sm:text-lg leading-snug tracking-tight group-hover:text-amber-200 transition-colors line-clamp-2">
            {item.title}
          </h3>
        </Link>

        {item.summary && (
          <p className="hidden sm:block text-[13px] text-[var(--color-fg-muted)] leading-snug mt-1.5 line-clamp-2 max-w-[76ch]">
            {item.summary}
          </p>
        )}

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 overline-amber hover:text-amber-200 transition-colors w-fit"
            style={{ fontSize: "10px", letterSpacing: "0.2em" }}
          >
            <ExternalLink className="h-2.5 w-2.5" /> Read original
          </a>
        )}
      </div>
    </article>
  );
}
