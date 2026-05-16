/**
 * Reading queue. The optimistic mutations live in FeedItemCard for save/unsave
 * from elsewhere in the app; the per-row remove/markRead here are also
 * optimistic so the UI never blocks on a round trip.
 */
import { Check, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryAccentClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export default function ReadingQueuePage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const listQuery = trpc.readingQueue.list.useQuery(undefined, { enabled: isAuthenticated });

  const markRead = trpc.readingQueue.markRead.useMutation({
    onMutate: async ({ id }) => {
      await utils.readingQueue.list.cancel();
      const prev = utils.readingQueue.list.getData();
      utils.readingQueue.list.setData(undefined, (old) =>
        old?.map((q) => (q.id === id ? { ...q, isRead: true } : q))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && utils.readingQueue.list.setData(undefined, ctx.prev),
    onSettled: () => {
      utils.readingQueue.list.invalidate();
      utils.readingQueue.unreadCount.invalidate();
    },
  });

  const remove = trpc.readingQueue.remove.useMutation({
    onMutate: async ({ id }) => {
      await utils.readingQueue.list.cancel();
      const prev = utils.readingQueue.list.getData();
      utils.readingQueue.list.setData(undefined, (old) => old?.filter((q) => q.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && utils.readingQueue.list.setData(undefined, ctx.prev),
    onSettled: () => {
      utils.readingQueue.list.invalidate();
      utils.readingQueue.unreadCount.invalidate();
    },
  });

  const markAll = trpc.readingQueue.markAllRead.useMutation({
    onSuccess: () => {
      utils.readingQueue.list.invalidate();
      utils.readingQueue.unreadCount.invalidate();
      toast.success("Everything marked read");
    },
  });

  if (!isAuthenticated) {
    return (
      <div>
        <PageHeader overline="The Desk · Reading queue" title="Sign in to save items" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          Bookmarks live with your account. Sign in to start your queue.
        </p>
      </div>
    );
  }

  const items = listQuery.data ?? [];
  const unread = items.filter((i) => !i.isRead);

  return (
    <div>
      <PageHeader
        overline="The Desk · Reading queue"
        title="Saved items"
        kicker={
          items.length === 0
            ? "Nothing here yet. Save anything from the daily feed."
            : `${unread.length} unread of ${items.length} saved`
        }
        actions={
          unread.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <SectionErrorBoundary section="Reading queue">
        {listQuery.isLoading ? (
          <QueueSkeleton />
        ) : items.length === 0 ? (
          <div className="panel p-8 rounded text-center text-sm text-[var(--color-fg-muted)]">
            Bookmark any story from the daily feed to read later.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((q) => (
              <li
                key={q.id}
                className={cn(
                  "panel panel-hover p-4 rounded transition-colors",
                  q.feedCategory ? categoryAccentClass(q.feedCategory) : "accent-other",
                  q.isRead && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {q.feedCategory && (
                        <span className="overline" style={{ color: "var(--color-amber)" }}>
                          {q.feedCategory}
                        </span>
                      )}
                      {q.feedSource && <span className="overline">{q.feedSource}</span>}
                      <span className="overline">{formatRelative(q.createdAt)}</span>
                    </div>
                    {q.feedTitle ? (
                      <Link
                        href={q.feedItemId ? `/story/${q.feedItemId}` : "#"}
                        className="font-serif text-base leading-snug hover:text-amber-300"
                      >
                        {q.feedTitle}
                      </Link>
                    ) : (
                      <p className="font-serif text-base leading-snug">{q.customTitle ?? "Untitled"}</p>
                    )}
                    {q.feedSummary && (
                      <p className="text-sm text-[var(--color-fg-muted)] mt-1 leading-relaxed line-clamp-2">
                        {q.feedSummary}
                      </p>
                    )}
                    {(q.feedSourceUrl || q.customUrl) && (
                      <a
                        href={q.feedSourceUrl ?? q.customUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 overline hover:text-amber-300"
                      >
                        <ExternalLink className="h-3 w-3" /> Source
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!q.isRead && (
                      <button
                        aria-label="Mark read"
                        onClick={() => markRead.mutate({ id: q.id })}
                        className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      aria-label="Remove from queue"
                      onClick={() => remove.mutate({ id: q.id })}
                      className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionErrorBoundary>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="panel p-4 rounded space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
