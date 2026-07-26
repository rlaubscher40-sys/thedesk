/**
 * Index strip — the front-page contents.
 *
 * Five equal columns with hairline dividers, each `NN · CATEGORY` over a
 * 16.5px Playfair headline. Replaces the collapsible "Today in brief"
 * panel: it does the same job (absorb the day in ten seconds) but as the
 * masthead's contents row rather than a card the reader has to open.
 */
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { cleanHeadline } from "@/lib/headline";
import { useReadStories } from "@/lib/useReadStories";
import { GUTTER_X } from "../tokens";

const COLUMNS = 5;

export function IndexStrip({ items }: { items: DailyFeedItem[] }) {
  const colourFor = useCategoryColour();
  const { isRead } = useReadStories();
  const shown = items.slice(0, COLUMNS);
  if (shown.length === 0) return null;

  return (
    // Hidden on phones: the contents row is a front-page device, and at
    // 390px it becomes five stacked rows the reader has to scroll past to
    // reach the lead. The mobile layout goes masthead → lanes → lead.
    <nav
      className={cn(GUTTER_X, "rule-hair-b hidden sm:grid sm:grid-cols-2 lg:grid-cols-5")}
      aria-label="Today's contents"
    >
      {shown.map((item, i) => (
        <Link
          key={item.id}
          href={`/story/${item.id}`}
          className={cn(
            "bs-row block py-4 min-w-0",
            i > 0 && "lg:rule-hair-l lg:pl-5",
            i < shown.length - 1 && "lg:pr-5"
          )}
        >
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.16em", color: colourFor(item.category) }}
          >
            {String(i + 1).padStart(2, "0")} · {item.category}
          </span>
          <p
            className="font-serif mt-1.5"
            style={{
              fontSize: 16.5,
              lineHeight: 1.24,
              letterSpacing: "-0.02em",
              opacity: isRead(String(item.id)) ? 0.6 : 1,
            }}
          >
            {cleanHeadline(item.title)}
          </p>
        </Link>
      ))}
    </nav>
  );
}
