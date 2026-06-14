/**
 * "Today in brief" scan strip, dot-point summary of today's stories so a
 * reader can absorb the day in 10 seconds before drilling into the lead
 * card and the rest of the feed.
 *
 * Each row: category accent, the headline as a tap target to the
 * underlying /story/:id page, and the sayThis line (if present) as
 * a faded sub-line. Collapsible, but defaults expanded everywhere: it now
 * sits at the top of the feed as the first stories a reader meets, so a
 * collapsed header would defeat the point. Choice persists to localStorage.
 */
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { categoryColour } from "@/lib/category";
import { useBookmarks } from "@/lib/useBookmarks";
import { useReadStories } from "@/lib/useReadStories";

const STORAGE_KEY = "thedesk:today-brief-expanded";
const ITEMS_SHOWN = 6;

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return true;
}

export function TodayInBrief({ items }: { items: DailyFeedItem[] }) {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);
  const { isBookmarked, toggle } = useBookmarks();
  const { isRead } = useReadStories();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  const shown = items.slice(0, ITEMS_SHOWN);
  if (shown.length === 0) return null;

  return (
    <section
      className="panel rounded-sm overflow-hidden mb-8"
      aria-label="Today in brief"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="today-in-brief-body"
        className="w-full px-5 sm:px-6 py-4 flex items-baseline justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
        style={{ borderBottomWidth: expanded ? 1 : 0, borderColor: "var(--color-border)" }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <p
            className="overline-amber"
            style={{ letterSpacing: "0.22em", fontSize: "11px" }}
          >
            Today in brief
          </p>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
          >
            {shown.length} stor{shown.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <ol id="today-in-brief-body" className="divide-y divide-[var(--color-border)]">
          {shown.map((item, idx) => {
            // Read state dims an opened story so a returning reader's eye goes
            // to what's still unread; the leading index glows amber while
            // unread, mutes once seen.
            const unread = !isRead(item.id);
            const saved = isBookmarked(String(item.id));
            return (
              <li key={item.id} className="flex items-stretch">
                <Link
                  href={`/story/${item.id}`}
                  className="flex-1 min-w-0 grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[44px_120px_minmax(0,1fr)] gap-3 sm:gap-4 pl-5 sm:pl-6 py-3.5 hover:bg-white/[0.025] transition-colors"
                >
                  <span
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.12em",
                      color: unread ? "var(--color-amber)" : "var(--color-fg-subtle)",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="hidden sm:inline font-mono uppercase truncate"
                    style={{
                      color: categoryColour(item.category),
                      fontSize: "10px",
                      letterSpacing: "0.18em",
                    }}
                    title={item.category}
                  >
                    {item.category}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="font-serif leading-snug"
                      style={{
                        fontSize: "15px",
                        color: unread ? "var(--color-fg)" : "var(--color-fg-muted)",
                      }}
                    >
                      {item.title}
                    </p>
                    {(item.whyItMatters || item.sayThis) && (
                      <p
                        className="text-[var(--color-fg-subtle)] mt-1 leading-snug line-clamp-1"
                        style={{ fontSize: "12.5px" }}
                      >
                        {item.whyItMatters ?? item.sayThis}
                      </p>
                    )}
                  </div>
                </Link>
                {/* Save straight from the scan — same localStorage bookmark set
                    as the cards and the sidebar count, so a tap here keeps the
                    reader moving without opening the story first. */}
                <button
                  type="button"
                  onClick={() => toggle(String(item.id))}
                  aria-label={saved ? "Remove bookmark" : "Save story"}
                  aria-pressed={saved}
                  className="px-4 flex items-center text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
                >
                  {saved ? (
                    <BookmarkCheck className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
