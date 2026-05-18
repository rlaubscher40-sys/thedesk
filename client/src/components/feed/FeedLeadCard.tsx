/**
 * Front-page lead. Wider, taller, gets a full hero "cover plate" on the
 * left and the editorial column on the right. The hero plate is a
 * category-tinted gradient panel, no AI imagery on individual feed items
 * in demo mode, so we render an editorial gradient cover with the category
 * label set large.
 */
import { useState } from "react";
import {
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

  // Fallback hero plate: when the story has no og:image, pull a
  // deterministic image from the hero library so the lead card doesn't
  // sit as a bare category-text gradient. Keyed by item.id so the same
  // lead always gets the same fallback. The query is suspended when
  // imageUrl is already present.
  const libraryFallback = trpc.heroLibrary.pickForSeed.useQuery(
    { seed: item.id },
    { enabled: !item.imageUrl, staleTime: 60 * 60 * 1000 }
  );
  const fallbackUrl = !item.imageUrl ? libraryFallback.data?.url ?? null : null;

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
  // Adopt the image's natural aspect ratio once it loads so news og:images
  // of any shape (landscape banners, square portraits, vertical scrolls)
  // fill the cover plate exactly, no object-cover crops, no empty
  // gradient bands above or below. Capped to a sensible window so a
  // single weird tall image doesn't blow the grid.
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    // Clamp 4:5 (0.8) ↔ 16:9 (1.78). Anything more extreme falls back
    // to a sensible default rather than dominating the layout.
    setImageAspect(Math.min(1.78, Math.max(0.8, ratio)));
  }

  const queueQuery = trpc.readingQueue.list.useQuery(undefined, { enabled: isAuthenticated });
  const inQueueId = queueQuery.data?.find((q) => q.feedItemId === item.id)?.id;

  const add = trpc.readingQueue.add.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });
  const remove = trpc.readingQueue.remove.useMutation({
    onSettled: () => utils.readingQueue.list.invalidate(),
  });

  // Admin priority toggle: pin to 100 (locks the story as the lead) or
  // reset to default 50. Categories/sources keep ingest-time defaults at
  // 50-80, pinning at 100 always wins.
  const isPinned = (item.priority ?? 50) >= 100;
  const setPriority = trpc.feed.setPriority.useMutation({
    onSuccess: () => {
      utils.feed.getByDate.invalidate();
      toast.success(isPinned ? "Unpinned from lead" : "Pinned as lead");
    },
    onError: () => toast.error("Couldn't update priority"),
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
    `Via The Desk · ${SITE_DISPLAY}`,
  ].join("\n").trim();

  return (
    <article
      className={cn(
        // Single-column stack with a sane max-width on the card itself
        // so the lead doesn't span a 1400px viewport edge-to-edge. The
        // card is centred under the page header; image fills the card
        // width, editorial flows below without needing its own
        // internal max-width.
        "panel hover-lift rounded overflow-hidden mx-auto w-full max-w-[960px]",
        categoryAccentClass(item.category)
      )}
    >
      {/* Hero plate, og:image when scraped, otherwise an editorial
          gradient keyed to the category. The category gradient ALWAYS
          renders as the background, even when an image is present —
          object-contain on the image means odd aspect ratios (very
          common for news og:images) sit centred with gradient filler
          peeking through the edges rather than getting savagely cropped. */}
      <Link
        href={`/story/${item.id}`}
        // The card has its own max-width now (960px), so the image
        // can take its full natural aspect without dominating the
        // viewport. No more max-height clamp, that was the source
        // of the zoom-in crop.
        className="relative block overflow-hidden w-full"
        style={{
          aspectRatio: imageAspect ?? (item.imageUrl ? 5 / 3 : 5 / 3),
          background: `
            radial-gradient(circle at 78% 22%, ${categoryColour(item.category)}50 0%, transparent 55%),
            radial-gradient(circle at 14% 86%, ${categoryColour(item.category)}1a 0%, transparent 55%),
            var(--grad-panel-soft)
          `,
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.category}
            // object-top so any rare max-height clamp on a tall portrait
            // preserves the top of the image (faces) rather than centring
            // the crop through somebody's chin.
            className="absolute inset-0 w-full h-full object-cover object-top"
            loading="lazy"
            decoding="async"
            onLoad={onImageLoad}
          />
        ) : fallbackUrl ? (
          // Hero-library fallback, used when the story didn't come with
          // an og:image. Deterministic per item ID so the cover doesn't
          // flicker between renders.
          <img
            src={fallbackUrl}
            alt={item.category}
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
        ) : (
          // Final fallback, library empty too. Render the category
          // gradient + supersized category name we've always had.
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
          className="absolute inset-0 pointer-events-none cover-vignette"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 50%, oklch(0.08 0.018 260 / 60%) 100%)",
          }}
          aria-hidden="true"
        />

        {/* "LEAD STORY" badge, bottom-left, sits over the cover image.
            Source + date moved into the editorial column below so the
            badge isn't fighting tiny text overlaid on a photo. */}
        <div className="absolute bottom-5 left-5">
          <p
            className="overline-amber"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Lead story
          </p>
        </div>
      </Link>

      {/* Editorial column, sits below the cover plate at the full
          card width (960px max via the parent article). Hairline rules
          group the sections, title+lede / source / take / angles. */}
      <div className="px-6 py-7 sm:px-10 sm:py-9 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
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
              className="p-2 sm:p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
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

        <Link href={`/story/${item.id}`} className="block group mb-4">
          <h2 className="display-2 group-hover:text-amber-200 transition-colors">
            {item.title}
          </h2>
        </Link>

        {/* Lede. Plain serif rather than italic, italic Playfair gets squished
            at body sizes on a dark background and was reading as cramped. The
            magazine register stays via the serif face and the surrounding
            chrome; the italic was carrying too much load. */}
        <p className="font-serif text-lg text-[var(--color-fg-muted)] leading-relaxed mb-5">
          {item.summary}
        </p>

        {/* Source + meta row. Sits between the lede and the editorial
            take, separated by hairline rules on each side. */}
        {(item.sourceUrl || item.source) && (
          <div className="flex items-center justify-between gap-4 flex-wrap mt-1 pt-5 pb-1 border-t border-[var(--color-border)]">
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Read original
              </a>
            ) : (
              <span />
            )}
            <p className="overline text-[var(--color-fg-subtle)]">
              {item.source} · {item.feedDate}
            </p>
          </div>
        )}

        {/* Editor's take, Ruben's note overrides the auto-generated
            sayThis line when set. Say This + Partner Angles are
            paired, neither renders without the other unless an admin
            has hand-written a Ruben's note. */}
        {(item.rubensNote || (item.sayThis && item.partnerTag)) && (
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <RubensNoteBlock itemId={item.id} note={item.rubensNote} />
            {!item.rubensNote && item.sayThis && item.partnerTag && (
              <SayThisLine sayThis={item.sayThis} category={item.category} />
            )}
          </div>
        )}

        {/* PartnerTagBlock paints its own border-t + top margin so we
            don't wrap it here, would create a double hairline. */}
        {item.partnerTag && <PartnerTagBlock raw={item.partnerTag} />}

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
