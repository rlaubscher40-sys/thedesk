/**
 * Card for a single daily feed item. Composed from PartnerTagBlock,
 * SayThisLine, and a "save to queue" action that uses optimistic updates
 * (improvement #10).
 */
import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Linkedin } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { categoryAccentClass } from "@/lib/category";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "../ui/Button";
import { LinkedInPostModal } from "../LinkedInPostModal";
import { PartnerTagBlock } from "./PartnerTagBlock";
import { SayThisLine } from "./SayThisLine";

export function FeedItemCard({ item }: { item: DailyFeedItem }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [linkedInOpen, setLinkedInOpen] = useState(false);

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

  const linkedInDraft = buildLinkedInDraft(item);

  return (
    <article
      className={cn(
        "panel panel-hover p-5 rounded transition-colors",
        categoryAccentClass(item.category)
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <span className="overline" style={{ color: "var(--color-amber)" }}>
            {item.category}
          </span>
          <span className="overline">{item.source}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleQueue}
            aria-label={inQueueId ? "Remove from queue" : "Save to queue"}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300"
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
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300"
          >
            <Linkedin className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Link href={`/story/${item.id}`} className="block group">
        <h3 className="font-serif text-lg leading-snug mb-2 group-hover:text-amber-300 transition-colors">
          {item.title}
        </h3>
      </Link>

      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{item.summary}</p>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-[var(--color-fg-muted)] hover:text-amber-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Read original
        </a>
      )}

      {item.sayThis && (
        <SayThisLine sayThis={item.sayThis} category={item.category} />
      )}

      <PartnerTagBlock raw={item.partnerTag} />

      <LinkedInPostModal
        open={linkedInOpen}
        onOpenChange={setLinkedInOpen}
        initialText={linkedInDraft}
        heading="Share this story on LinkedIn"
      />
    </article>
  );
}

function buildLinkedInDraft(item: DailyFeedItem): string {
  const lines = [
    item.title,
    "",
    item.summary,
    item.sayThis ? `\nMy take: ${item.sayThis}` : "",
    "",
    "Via The Desk — thedeskglobal.manus.space",
  ];
  return lines.filter((l) => l !== "" || true).join("\n").trim();
}
