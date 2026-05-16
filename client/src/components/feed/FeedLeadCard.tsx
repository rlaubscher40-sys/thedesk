/**
 * Front-page lead. Wider, taller, gets a full hero "cover plate" on the
 * left and the editorial column on the right. The hero plate is a
 * category-tinted gradient panel — no AI imagery on individual feed items
 * in demo mode, so we render an editorial gradient cover with the category
 * label set large.
 */
import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Linkedin, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { SITE_DISPLAY } from "@/lib/siteUrl";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { LinkedInPostModal } from "../LinkedInPostModal";
import { PartnerTagBlock } from "./PartnerTagBlock";
import { RubensNoteBlock } from "./RubensNoteBlock";
import { SayThisLine } from "./SayThisLine";

export function FeedLeadCard({ item }: { item: DailyFeedItem }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

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
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  const queueQuery = trpc.readingQueue.list.useQuery(undefined, { enabled: isAuthenticated });
  const inQueueId = queueQuery.data?.find((q) => q.feedItemId === item.id)?.id;

  const add = trpc.readingQueue.add.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });
  const remove = trpc.readingQueue.remove.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });

  function toggleQueue() {
    if (!isAuthenticated) {
      toast.message("Sign in to save items");
      return;
    }
    if (inQueueId) remove.mutate({ id: inQueueId });
    else add.mutate({ feedItemId: item.id });
  }

  const linkedInDraft = [
    item.title,
    "",
    item.summary,
    item.sayThis ? `\nMy take: ${item.sayThis}` : "",
    "",
    `Via The Desk — ${SITE_DISPLAY}`,
  ].join("\n").trim();

  return (
    <article
      className={cn(
        "panel hover-lift rounded overflow-hidden grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]",
        categoryAccentClass(item.category)
      )}
    >
      {/* Hero plate — AI-generated thumbnail when present, otherwise an
          editorial gradient keyed to the category. */}
      <Link
        href={`/story/${item.id}`}
        className="relative block aspect-[5/3] lg:aspect-auto lg:min-h-[460px] overflow-hidden"
        style={
          item.imageUrl
            ? undefined
            : {
                background: `
                  radial-gradient(circle at 78% 22%, ${categoryColour(item.category)}50 0%, transparent 55%),
                  radial-gradient(circle at 14% 86%, oklch(0.55 0.18 270 / 18%) 0%, transparent 55%),
                  linear-gradient(135deg, oklch(0.16 0.022 260) 0%, oklch(0.08 0.022 260) 100%)
                `,
              }
        }
      >
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {/* Category supersized — the cover plate's typographic moment.
            Hidden when a real photo is present. */}
        {!item.imageUrl && (
          <span
            className="absolute font-serif font-bold pointer-events-none select-none"
            style={{
              top: "8%",
              left: "6%",
              right: "6%",
              color: categoryColour(item.category),
              opacity: 0.18,
              fontSize: "clamp(72px, 9vw, 144px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              mixBlendMode: "screen",
            }}
          >
            {item.category}
          </span>
        )}

        {/* Grain + vignette. */}
        <span
          className="absolute inset-0 noise-overlay pointer-events-none"
          style={{ opacity: 0.5 }}
          aria-hidden="true"
        />
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 50%, oklch(0.08 0.018 260 / 60%) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Slug strip — bottom-left badge. */}
        <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
          <div>
            <p className="overline-amber mb-1" style={{ letterSpacing: "0.2em" }}>
              Lead story
            </p>
            <p className="overline">{item.source}</p>
          </div>
          <p className="overline">{item.feedDate}</p>
        </div>
      </Link>

      {/* Editorial column. */}
      <div className="p-6 sm:p-8 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="overline-amber"
            style={{ color: categoryColour(item.category), letterSpacing: "0.2em" }}
          >
            {item.category}
          </span>
          <div className="flex items-center gap-1 -mr-2">
            <button
              onClick={toggleQueue}
              aria-label={inQueueId ? "Remove from queue" : "Save to queue"}
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
            >
              {inQueueId ? (
                <BookmarkCheck className="h-4 w-4 text-amber-400" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setLinkedInOpen(true)}
              aria-label="Share to LinkedIn"
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
            >
              <Linkedin className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                aria-label="Delete story (admin)"
                title="Delete story (admin only)"
                className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <Link href={`/story/${item.id}`} className="block group mb-4">
          <h2 className="display-2 group-hover:text-amber-200 transition-colors">
            {item.title}
          </h2>
        </Link>

        <p className="font-serif italic text-lg text-[var(--color-fg-muted)] leading-relaxed mb-5">
          {item.summary}
        </p>

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors self-start"
          >
            <ExternalLink className="h-3 w-3" /> Read original
          </a>
        )}

        <RubensNoteBlock itemId={item.id} note={item.rubensNote} />
        {!item.rubensNote && item.sayThis && (
          <SayThisLine sayThis={item.sayThis} category={item.category} />
        )}

        <PartnerTagBlock raw={item.partnerTag} />

        <LinkedInPostModal
          open={linkedInOpen}
          onOpenChange={setLinkedInOpen}
          initialText={linkedInDraft}
          heading="Share this story on LinkedIn"
        />
      </div>
    </article>
  );
}
