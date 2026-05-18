/**
 * Bookmark toggle. Uses the local-bookmarks hook so the icon switches
 * state instantly without a server round-trip. If the user is
 * authenticated, fires the tRPC readingQueue.add/remove mutation
 * alongside so the cross-device queue stays in sync.
 *
 * Toasts on add/remove.
 */
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { useBookmarks } from "@/lib/useBookmarks";

type Props = {
  /** Local id used in localStorage (story.id from the data file). */
  id: string;
  /** Story headline, included in the toast. */
  title: string;
};

export function BookmarkButton({ id, title }: Props) {
  const { isBookmarked, toggle } = useBookmarks();
  const saved = isBookmarked(id);

  function onClick() {
    toggle(id);
    if (saved) toast("Removed from queue", { description: title });
    else toast.success("Saved to queue", { description: title });
  }

  return (
    <button
      onClick={onClick}
      aria-label={saved ? "Remove from reading queue" : "Save to reading queue"}
      aria-pressed={saved}
      className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4 text-amber-400" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}
