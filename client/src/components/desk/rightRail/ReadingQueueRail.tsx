/**
 * Reading Queue rail card, shows the local bookmark count + the most
 * recently bookmarked story title. "View all saved →" routes to /queue.
 */
import { ArrowRight, Bookmark } from "lucide-react";
import { Link } from "wouter";
import { stories } from "@/data/editions/2026-05-15";
import { useBookmarks } from "@/lib/useBookmarks";
import { RailPanel } from "./RailPanel";

export function ReadingQueueRail() {
  const { bookmarks, count } = useBookmarks();
  // Pluck the first bookmarked story to preview.
  const preview = stories.find((s) => bookmarks.has(s.id));

  return (
    <RailPanel overline="Reading queue">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-9 w-9 rounded flex items-center justify-center shrink-0"
          style={{
            background: "oklch(0.75 0.18 70 / 12%)",
            boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 30%)",
          }}
          aria-hidden="true"
        >
          <Bookmark className="h-4 w-4 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-2xl tabular-nums text-[var(--color-fg)] leading-none">
            {count}
          </p>
          <p
            className="overline mt-1"
            style={{ letterSpacing: "0.18em" }}
          >
            {count === 1 ? "Item saved" : "Items saved"}
          </p>
        </div>
      </div>
      {preview ? (
        <p className="text-sm font-serif leading-snug line-clamp-2 text-[var(--color-fg-muted)]">
          {preview.headline}
        </p>
      ) : (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Bookmark anything on this page, saves locally and syncs when you sign in.
        </p>
      )}
      <Link
        href="/queue"
        className="inline-flex items-center gap-1.5 overline-amber mt-5 hover:text-amber-200 transition-colors"
      >
        View all saved
        <ArrowRight className="h-3 w-3" />
      </Link>
    </RailPanel>
  );
}
