/**
 * "Also on the wire" — a 180px mono label column beside hairline-separated
 * rows of `CATEGORY | headline | source`.
 *
 * Replaces the FeedSignalStrip card list. Same items (stories that landed
 * for awareness without earning a Say This or partner angles), rendered as
 * an index rather than a stack of demoted cards.
 */
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { cleanHeadline } from "@/lib/headline";
import { GUTTER_X } from "../tokens";

export function Wire({ items }: { items: DailyFeedItem[] }) {
  const colourFor = useCategoryColour();
  if (items.length === 0) return null;

  return (
    <section className={cn(GUTTER_X, "rule-hair mt-10 pt-5")} aria-label="Also on the wire">
      <div className="grid lg:grid-cols-[180px_minmax(0,1fr)]">
        <p className="bs-label pt-1.5 mb-3 lg:mb-0" style={{ letterSpacing: "0.24em" }}>
          Also on the wire
        </p>
        <div>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/story/${item.id}`}
              className="bs-row rule-hair-b flex items-baseline gap-4 sm:gap-6 py-3.5"
            >
              <span
                className="font-mono uppercase shrink-0 w-[92px] sm:w-[104px]"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  color: colourFor(item.category),
                }}
              >
                {item.category}
              </span>
              <span
                className="font-serif flex-1 min-w-0"
                style={{ fontSize: 20, lineHeight: 1.3, letterSpacing: "-0.02em" }}
              >
                {cleanHeadline(item.title)}
              </span>
              {item.source && (
                <span
                  className="font-mono shrink-0 hidden sm:block text-[var(--color-fg-subtle)]"
                  style={{ fontSize: 10 }}
                >
                  {item.source}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
