/**
 * Dense lead card used at the top of the coverage lanes (Business, Tech &
 * Science, Global).
 *
 * The enriched FeedLeadCard carries a hero plate, magazine serif headline,
 * "Lead story" badge, hairline-divided columns for source, why-it-matters,
 * counterpoint, Say This and partner angles. On coverage lanes those blocks
 * are all empty (the channel skips enrichment), so the broadsheet treatment
 * lands as the same form-content mismatch the grid had before
 * CoverageFeedCard fixed it: a huge container around a single RSS sentence.
 *
 * This dense variant matches the form to the content tier — same vocabulary
 * as CoverageFeedCard but slightly larger so the lead still leads its lane:
 * sans semibold headline, ~2× the dek of a grid card, single "Read original"
 * footer. Hero plate is preserved when there's an image (skipped when there
 * isn't, no library fallback — coverage shouldn't manufacture art).
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

export function CoverageLeadCard({ item }: { item: DailyFeedItem }) {
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

  const title = cleanHeadline(item.title);
  const dek = cardDek(item);
  const catColour = categoryColour(item.category);
  const linkedInDraft = buildStoryShareDraft(item);

  return (
    <Card
      lift
      revealOnHover
      panelHover
      clip
      className="mx-auto w-full max-w-[860px]"
      accentClass={categoryAccentClass(item.category)}
    >
      {/* No hero plate on coverage lanes: we don't render source publisher
          photos (uncleared press images), and manufacturing library art for
          what is structurally an RSS headline would re-create the form/content
          mismatch CoverageFeedCard fixed. */}

      {/* Editorial column. Tighter padding than FeedLeadCard so the dense
          register matches the grid cards below, but a notch larger than
          a grid card so it still reads as the lane's lead. */}
      <div className="px-5 py-5 sm:px-7 sm:py-6 flex flex-col gap-3">
        {/* Meta + actions row. Same dot+category vocabulary as the grid
            card, plus a small "TOP STORY" overline so the lead is still
            self-identifying. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 overline">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: catColour }}
              aria-hidden="true"
            />
            <span
              className="shrink-0"
              style={{ color: catColour, letterSpacing: "0.2em" }}
            >
              {item.category}
            </span>
            <span className="shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true">
              ·
            </span>
            <span className="truncate text-[var(--color-fg-subtle)]">{item.source}</span>
            <CorroborationBadge
              count={item.corroborationCount}
              sources={item.corroboratingSources}
            />
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mr-2 -mt-1 reveal-target">
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
                className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Headline — sans semibold, larger than a grid card but explicitly
            not display-2/Playfair. Reserves the broadsheet face for the
            enriched lanes. */}
        <Link href={`/story/${item.id}`} className="block group">
          <h2 className="text-[20px] sm:text-[22px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-fg)] group-hover:text-amber-200 transition-colors">
            {title}
          </h2>
        </Link>

        {/* Dek. ~3 lines worth of body, vs the grid card's 2 — the lead
            earns a little more dek without slipping back into broadsheet
            territory. */}
        {dek && (
          <p className="text-[14px] sm:text-[15px] text-[var(--color-fg-muted)] leading-relaxed line-clamp-3">
            {dek.text}
          </p>
        )}

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
          initialText={linkedInDraft}
          heading="Share this story on LinkedIn"
        />
      </div>
    </Card>
  );
}
