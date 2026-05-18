/**
 * "Today in brief" scan strip, dot-point summary of today's stories so a
 * reader can absorb the day in 10 seconds before drilling into the lead
 * card and the rest of the feed.
 *
 * Each row: category accent, the headline as a tap target to the
 * underlying /story/:id page, and the sayThis line (if present) as
 * a faded sub-line. Collapsible, defaults expanded on desktop and
 * collapsed on mobile, choice persists to localStorage.
 */
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { categoryColour } from "@/lib/category";

const STORAGE_KEY = "thedesk:today-brief-expanded";
const ITEMS_SHOWN = 6;

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.innerWidth >= 768;
}

export function TodayInBrief({ items }: { items: DailyFeedItem[] }) {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);

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
          {shown.map((item, idx) => (
            <li key={item.id}>
              <Link
                href={`/story/${item.id}`}
                className="grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[44px_120px_minmax(0,1fr)] gap-3 sm:gap-4 px-5 sm:px-6 py-3.5 hover:bg-white/[0.025] transition-colors"
              >
                <span
                  className="font-mono tabular-nums text-amber-400/80"
                  style={{ fontSize: "11px", letterSpacing: "0.12em" }}
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
                    className="font-serif leading-snug text-[var(--color-fg)]"
                    style={{ fontSize: "15px" }}
                  >
                    {item.title}
                  </p>
                  {item.sayThis && (
                    <p
                      className="text-[var(--color-fg-subtle)] mt-1 leading-snug line-clamp-1"
                      style={{ fontSize: "12.5px" }}
                    >
                      {item.sayThis}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
