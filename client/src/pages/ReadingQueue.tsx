/**
 * Reading queue. Two modes driven by auth:
 *
 *   - Authenticated: server-side queue with read/unread tracking, per-item
 *     remove, "mark all read", optimistic mutations.
 *   - Anonymous: localStorage bookmarks. Hydrated by a single feed.getByIds
 *     batch fetch so the same UI can render either source.
 *
 * Both modes share status tabs (All / Unread / Read, meaningful only when
 * authenticated) and a "group by category" toggle.
 *
 * Redesign: the panel cards are gone. Saved items are an index — a meta
 * column beside headline and summary, on hairlines — matching the Archive
 * results. All queue behaviour and its optimistic mutations are unchanged.
 */
import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageTitle } from "@/components/broadsheet/PageTitle";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { useCategoryColour } from "@/lib/category";
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

  return isAuthenticated ? (
    <AuthQueue status={status} grouped={grouped} onStatus={setStatus} onGrouped={setGrouped} />
  ) : (
    <AnonQueue grouped={grouped} onGrouped={setGrouped} />
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
    <div>
      <PageTitle
        kicker="The Desk · Reading queue"
        title="Saved items"
        standfirst={
          rows.length === 0
            ? "Nothing here yet. Bookmark stories from Today or the Archive."
            : `${unreadCount} unread of ${rows.length} saved.`
        }
        stats={
          rows.length > 0
            ? [
                { label: "Saved", value: String(rows.length) },
                { label: "Unread", value: String(unreadCount) },
              ]
            : []
        }
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="bs-btn bs-btn-outline"
            >
              Mark all read
            </button>
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
      <div className={GUTTER_X}>
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
      </div>
    </div>
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
    <div>
      <PageTitle
        kicker="The Desk · Reading queue"
        title="Saved items"
        standfirst={
          ids.length === 0
            ? "Nothing here yet. Bookmark stories from Today or the Archive."
            : `${ids.length} saved, stored on this device.`
        }
        stats={ids.length > 0 ? [{ label: "Saved", value: String(ids.length) }] : []}
      />
      <Toolbar
        status="all"
        onStatus={() => {}}
        grouped={grouped}
        onGrouped={onGrouped}
        showStatusTabs={false}
      />
      <div className={GUTTER_X}>
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
              onRemove={(idStr) => toggle(idStr.slice(2))}
            />
          )}
        </SectionErrorBoundary>
      </div>
    </div>
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
    <div
      className={cn(
        GUTTER_X,
        "rule-major rule-hair-b mt-7 flex items-center justify-between gap-3 flex-wrap"
      )}
    >
      {showStatusTabs ? (
        <div className="flex">
          {(["all", "unread", "read"] as const).map((s, i) => {
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => onStatus(s)}
                aria-pressed={active}
                className={cn("bs-link py-3.5", i > 0 ? "rule-hair-l px-4" : "pr-4")}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: active ? "var(--color-fg)" : "var(--color-fg-muted)",
                }}
              >
                <span
                  style={{
                    borderBottom: active
                      ? "2px solid var(--color-accent-text)"
                      : "2px solid transparent",
                    paddingBottom: 3,
                  }}
                >
                  {s}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <span />
      )}
      <button
        onClick={() => onGrouped(!grouped)}
        className="bs-label bs-link py-3.5"
        title={grouped ? "Show as flat list" : "Group by category"}
      >
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
      <p className="py-10 text-[var(--color-fg-muted)]">Nothing matches this filter.</p>
    );
  }

  if (!grouped) {
    return (
      <div>
        {rows.map((row, i) => (
          <QueueRowIndex
            key={row.id}
            row={row}
            onMarkRead={onMarkRead}
            onRemove={onRemove}
            last={i === rows.length - 1}
          />
        ))}
      </div>
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
  const groups = Array.from(byCategory.entries()).sort(([, a], [, b]) => b.length - a.length);

  return (
    <div className="space-y-9">
      {groups.map(([category, items]) => (
        <section key={category}>
          <p className="bs-label mb-1.5" style={{ letterSpacing: "0.24em" }}>
            {category} · {items.length}
          </p>
          {items.map((row, i) => (
            <QueueRowIndex
              key={row.id}
              row={row}
              onMarkRead={onMarkRead}
              onRemove={onRemove}
              last={i === items.length - 1}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function QueueRowIndex({
  row,
  onMarkRead,
  onRemove,
  last,
}: {
  row: QueueRow;
  onMarkRead?: (id: string) => void;
  onRemove: (id: string) => void;
  last: boolean;
}) {
  const colourFor = useCategoryColour();
  return (
    <div
      className={cn(
        "bs-row rule-hair grid grid-cols-[96px_minmax(0,1fr)_auto] gap-4 sm:gap-5 py-4 items-baseline",
        last && "rule-hair-b",
        row.isRead && "opacity-60"
      )}
    >
      <div>
        {row.category && (
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: colourFor(row.category),
            }}
          >
            {row.category}
          </p>
        )}
        <p className="font-mono mt-1.5 text-[var(--color-fg-subtle)]" style={{ fontSize: 10 }}>
          {formatRelative(row.createdAt)}
        </p>
      </div>

      <div className="min-w-0">
        {row.feedItemId ? (
          <Link
            href={`/story/${row.feedItemId}`}
            className="bs-link font-serif block"
            style={{ fontSize: 21, lineHeight: 1.28, letterSpacing: "-0.02em" }}
          >
            {row.title}
          </Link>
        ) : (
          <p
            className="font-serif"
            style={{ fontSize: 21, lineHeight: 1.28, letterSpacing: "-0.02em" }}
          >
            {row.title}
          </p>
        )}
        {row.summary && (
          <p
            className="mt-1.5 text-[var(--color-fg-muted)] line-clamp-2"
            style={{ fontSize: 15, lineHeight: 1.55 }}
          >
            {row.summary}
          </p>
        )}
        {(row.source || row.sourceUrl) && (
          <p className="mt-1.5">
            {row.sourceUrl ? (
              <a
                href={row.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bs-label bs-link"
                style={{ letterSpacing: "0.14em" }}
              >
                {row.source ?? "Source"} ↗
              </a>
            ) : (
              <span className="bs-label" style={{ letterSpacing: "0.14em" }}>
                {row.source}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        {onMarkRead && !row.isRead && (
          <button
            aria-label="Mark read"
            onClick={() => onMarkRead(row.id)}
            className="bs-link p-2 text-[var(--color-fg-subtle)]"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          aria-label="Remove from queue"
          onClick={() => onRemove(row.id)}
          className="p-2 text-[var(--color-fg-subtle)] hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rule-hair-b py-16 text-center">
      <p className="font-serif italic text-[var(--color-fg-muted)]" style={{ fontSize: 21 }}>
        Empty queue.
      </p>
      <p className="mx-auto mt-3 max-w-[52ch] text-[var(--color-fg-muted)]">
        Bookmark anything from Today or the Archive. It&apos;ll sit here ready for when
        you have a window to read.
      </p>
      <div className="flex items-center justify-center gap-2.5 mt-6 flex-wrap">
        <Link href="/" className="bs-btn bs-btn-solid">
          Open Today
        </Link>
        <Link href="/archive" className="bs-btn bs-btn-outline">
          Browse the archive
        </Link>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4 pt-4" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-none" />
      ))}
    </div>
  );
}
