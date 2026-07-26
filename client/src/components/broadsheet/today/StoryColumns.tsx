/**
 * "More from today" — three hairline-divided columns.
 *
 * Each column: a 3:2 image, kicker, 28px headline, 16.5px summary, and the
 * Say This line as a one-line pull quote on a 3px accent rule. There is no
 * "Ruben's read" toggle: the take is the point of the card, so it renders
 * inline.
 *
 * Ragged column heights are not a defect here — with hairline columns
 * instead of floating cards there is nothing to line up, which is why the
 * `estimatedCardHeight` sort that used to pre-order the grid is gone.
 */
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { cardDek } from "@/lib/cardDek";
import { cleanHeadline } from "@/lib/headline";
import { dedash } from "@/lib/dedash";
import { readingMinutes } from "@/lib/readingTime";
import { GUTTER_X } from "../tokens";
import { StoryImage } from "../StoryImage";

export function StoryColumns({ items }: { items: DailyFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-5")} aria-label="More from today">
      <p className="bs-label mb-6" style={{ letterSpacing: "0.24em" }}>
        More from today
      </p>
      <div className="grid gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <StoryColumn
            key={item.id}
            item={item}
            className={cn(
              i % 3 !== 0 && "lg:rule-hair-l lg:pl-8",
              i % 3 !== 2 && "lg:pr-8",
              // The 2-up breakpoint needs its own divider rhythm.
              i % 2 !== 0 && "md:max-lg:rule-hair-l md:max-lg:pl-8",
              i % 2 !== 1 && "md:max-lg:pr-8"
            )}
          />
        ))}
      </div>
    </section>
  );
}

function StoryColumn({ item, className }: { item: DailyFeedItem; className?: string }) {
  const colourFor = useCategoryColour();
  const dek = cardDek(item);
  const take = item.rubensNote?.trim() || item.sayThis?.trim();

  return (
    <article className={cn("min-w-0", className)}>
      <Link href={`/story/${item.id}`} className="bs-link block">
        <StoryImage seed={item.id} category={item.category} alt="" aspect="3 / 2" />
        <p
          className="font-mono uppercase mt-4"
          style={{ fontSize: 10, letterSpacing: "0.18em", color: colourFor(item.category) }}
        >
          {item.category}
          {item.source ? ` · ${item.source}` : ""} · {readingMinutes(item)} min
        </p>
        <h3
          className="font-serif font-bold mt-2.5"
          style={{
            fontSize: "clamp(22px, 2.2vw, 28px)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            textWrap: "pretty",
          }}
        >
          {cleanHeadline(item.title)}
        </h3>
      </Link>

      {dek && (
        <p
          className="mt-3"
          style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--color-fg-muted)" }}
        >
          {dek.text}
        </p>
      )}

      {take && (
        <p
          className="font-serif mt-4 pl-4"
          style={{
            fontSize: 19,
            lineHeight: 1.34,
            letterSpacing: "-0.02em",
            borderLeft: "3px solid var(--color-accent-text)",
          }}
        >
          &ldquo;{dedash(take)}&rdquo;
        </p>
      )}
    </article>
  );
}
