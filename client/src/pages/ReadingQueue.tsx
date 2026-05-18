/**
 * Reading queue. Two modes driven by auth:
 *
 *   - Authenticated: server-side queue with read/unread tracking, per-item
 *     remove, "mark all read", optimistic mutations.
 *   - Anonymous: localStorage bookmarks. Hydrated by a single feed.getByIds
 *     batch fetch so the same UI can render either source.
 *
 * Both modes share status tabs (All / Unread / Read, Unread/Read only
 * meaningful when authenticated) and a "group by category" toggle that
 * folds the queue into category sections.
 */
import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  ExternalLink,
  LayoutGrid,
  List,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { useBookmarks } from "@/lib/useBookmarks";
import { trpc } from "@/lib/trpc";

type StatusFilter = "all" | "unread" | "read";

/**
 * Unified shape both auth + anonymous queues render against. Lets a
 * single list component handle either source.
 */
type QueueRow = {
  id: string;
  feedItemId: number | null;
  title: string;
  summary: string | null;
  source: string | null;
  category: string | null;
  sourceUrl: string | null;
  createdAt: Date;
  isRead: boolean;
};

export default function ReadingQueuePage() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [grouped, setGrouped] = useState(false);

  return (
    <div>
      {isAuthenticated ? (
        <AuthQueue status={status} grouped={grouped} onStatus={setStatus} onGrouped={setGrouped} />
      ) : (
        <AnonQueue grouped={grouped} onGrouped={setGrouped} />
      )}
    </div>
  );
}

// ─── Authenticated queue ────────────────────────────────────────────────────

function AuthQueue({
  status,
  grouped,
  onStatus,
  onGrouped,
}: {
  status: StatusFilter;
  grouped: boolean;
  onStatus: (s: StatusFilter) => void;
  onGrouped: (g: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const listQuery = trpc.readingQueue.list.useQuery();

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

  const rows: QueueRow[] = (listQuery.data ?? []).map((q) => ({
    id: `q-${q.id}`,
    feedItemId: q.feedItemId,
    title: q.feedTitle ?? q.customTitle ?? "Untitled",
    summary: q.feedSummary,
    source: q.feedSource,
    category: q.feedCategory,
    sourceUrl: q.feedSourceUrl ?? q.customUrl ?? null,
    createdAt: q.createdAt,
    isRead: q.isRead,
  }));
  const unreadCount = rows.filter((r) => !r.isRead).length;

  return (
    <>
      <PageHeader
        overline="The Desk · Reading queue"
        title="Saved items"
        kicker={
          rows.length === 0
            ? "Nothing here yet. Bookmark stories from Today or the Archive."
            : `${unreadCount} unread of ${rows.length} saved`
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />
      <Toolbar
        status={status}
        onStatus={onStatus}
        grouped={grouped}
        onGrouped={onGrouped}
        showStatusTabs
      />
      <SectionErrorBoundary section="Reading queue">
        {listQuery.isLoading ? (
          <QueueSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <QueueList
            rows={applyFilters(rows, status)}
            grouped={grouped}
            onMarkRead={(idStr) => {
              const id = Number(idStr.slice(2));
              if (Number.isFinite(id)) markRead.mutate({ id });
            }}
            onRemove={(idStr) => {
              const id = Number(idStr.slice(2));
              if (Number.isFinite(id)) remove.mutate({ id });
            }}
          />
        )}
      </SectionErrorBoundary>
    </>
  );
}

// ─── Anonymous queue ────────────────────────────────────────────────────────

function AnonQueue({
  grouped,
  onGrouped,
}: {
  grouped: boolean;
  onGrouped: (g: boolean) => void;
}) {
  const { bookmarks, toggle } = useBookmarks();
  const ids = useMemo(
    () =>
      Array.from(bookmarks)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0),
    [bookmarks]
  );
  const itemsQuery = trpc.feed.getByIds.useQuery(
    { ids },
    { enabled: ids.length > 0, staleTime: 60_000 }
  );

  const rows: QueueRow[] = (itemsQuery.data ?? [])
    .map(
      (item: DailyFeedItem): QueueRow => ({
        id: `f-${item.id}`,
        feedItemId: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        category: item.category,
        sourceUrl: item.sourceUrl,
        createdAt: item.createdAt,
        isRead: false,
      })
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <>
      <PageHeader
        overline="The Desk · Reading queue"
        title="Saved items"
        kicker={
          ids.length === 0
            ? "Nothing here yet. Bookmark stories from Today or the Archive."
            : `${ids.length} saved · stored on this device`
        }
      />
      <Toolbar
        status="all"
        onStatus={() => {}}
        grouped={grouped}
        onGrouped={onGrouped}
        showStatusTabs={false}
      />
      <SectionErrorBoundary section="Reading queue">
        {ids.length === 0 ? (
          <EmptyState />
        ) : itemsQuery.isLoading ? (
          <QueueSkeleton />
        ) : (
          <QueueList
            rows={rows}
            grouped={grouped}
            onMarkRead={undefined}
            onRemove={(idStr) => {
              const fid = idStr.slice(2);
              toggle(fid);
            }}
          />
        )}
      </SectionErrorBoundary>
    </>
  );
}

// ─── Shared toolbar, list, row ──────────────────────────────────────────────

function Toolbar({
  status,
  onStatus,
  grouped,
  onGrouped,
  showStatusTabs,
}: {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  grouped: boolean;
  onGrouped: (g: boolean) => void;
  showStatusTabs: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
      {showStatusTabs ? (
        <div className="inline-flex rounded-sm border border-[var(--color-border)] p-0.5">
          {(["all", "unread", "read"] as const).map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => onStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.18em] transition-colors",
                  active
                    ? "bg-amber-500/15 text-amber-200"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      ) : (
        <span />
      )}
      <button
        onClick={() => onGrouped(!grouped)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-fg-muted)] hover:text-amber-300 transition-colors border border-[var(--color-border)]"
        title={grouped ? "Show as flat list" : "Group by category"}
      >
        {grouped ? <List className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
        {grouped ? "Flat list" : "Group by category"}
      </button>
    </div>
  );
}

function applyFilters(rows: QueueRow[], status: StatusFilter): QueueRow[] {
  if (status === "all") return rows;
  if (status === "unread") return rows.filter((r) => !r.isRead);
  return rows.filter((r) => r.isRead);
}

function QueueList({
  rows,
  grouped,
  onMarkRead,
  onRemove,
}: {
  rows: QueueRow[];
  grouped: boolean;
  onMarkRead?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-fg-muted)]">
        Nothing matches this filter.
      </p>
    );
  }
  if (!grouped) {
    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <QueueRowCard
            key={row.id}
            row={row}
            onMarkRead={onMarkRead}
            onRemove={onRemove}
          />
        ))}
      </ul>
    );
  }

  // Group by category, preserving recency order within each group.
  const byCategory = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const k = row.category ?? "OTHER";
    const arr = byCategory.get(k) ?? [];
    arr.push(row);
    byCategory.set(k, arr);
  }
  const groups = Array.from(byCategory.entries()).sort(
    ([, a], [, b]) => b.length - a.length
  );

  return (
    <div className="space-y-8">
      {groups.map(([category, items]) => (
        <section key={category}>
          <div className="flex items-center gap-3 mb-3">
            <p
              className="overline-amber"
              style={{
                color: categoryColour(category),
                letterSpacing: "0.22em",
              }}
            >
              {category}
            </p>
            <span className="overline text-[var(--color-fg-subtle)] tabular-nums">
              {items.length}
            </span>
            <span
              className="block flex-1 h-px bg-[var(--color-border)]"
              aria-hidden="true"
            />
          </div>
          <ul className="space-y-3">
            {items.map((row) => (
              <QueueRowCard
                key={row.id}
                row={row}
                onMarkRead={onMarkRead}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function QueueRowCard({
  row,
  onMarkRead,
  onRemove,
}: {
  row: QueueRow;
  onMarkRead?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        "panel panel-hover p-4 rounded transition-colors",
        row.category ? categoryAccentClass(row.category) : "accent-other",
        row.isRead && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {row.category && (
              <span className="overline" style={{ color: "var(--color-amber)" }}>
                {row.category}
              </span>
            )}
            {row.source && <span className="overline">{row.source}</span>}
            <span className="overline">{formatRelative(row.createdAt)}</span>
          </div>
          {row.feedItemId ? (
            <Link
              href={`/story/${row.feedItemId}`}
              className="font-serif text-base leading-snug hover:text-amber-300"
            >
              {row.title}
            </Link>
          ) : (
            <p className="font-serif text-base leading-snug">{row.title}</p>
          )}
          {row.summary && (
            <p className="text-sm text-[var(--color-fg-muted)] mt-1 leading-relaxed line-clamp-2">
              {row.summary}
            </p>
          )}
          {row.sourceUrl && (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 overline hover:text-amber-300"
            >
              <ExternalLink className="h-3 w-3" /> Source
            </a>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {onMarkRead && !row.isRead && (
            <button
              aria-label="Mark read"
              onClick={() => onMarkRead(row.id)}
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            aria-label="Remove from queue"
            onClick={() => onRemove(row.id)}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="panel p-8 sm:p-10 rounded text-center max-w-xl mx-auto">
      <p className="font-serif italic text-lg text-[var(--color-fg-muted)] mb-2">
        Empty queue.
      </p>
      <p className="text-sm text-[var(--color-fg-muted)] mb-6 leading-relaxed">
        Bookmark anything from Today or the Archive. It'll sit here ready for
        when you have a window to read.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98]"
          style={{
            background:
              "var(--grad-cta-amber)",
            color: "var(--color-on-amber)",
          }}
        >
          Open Today
        </Link>
        <Link
          href="/archive"
          className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border)]"
        >
          Browse the archive
        </Link>
      </div>
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
