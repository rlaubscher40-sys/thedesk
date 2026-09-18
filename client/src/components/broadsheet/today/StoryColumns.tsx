import { ThreadLink } from "@/components/feed/ThreadLink";
/** One story treatment per item, with an optional expandable counterpoint. */
import { useReadStories } from "@/lib/useReadStories";
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { cardDek } from "@/lib/cardDek";
import { cleanHeadline } from "@/lib/headline";
import { dedash } from "@/lib/dedash";
import { readingMinutes } from "@/lib/readingTime";
import { GUTTER_X } from "../tokens";

export function StoryColumns({ items }: { items: DailyFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-5")} aria-label="More reporting">
      <p className="bs-label mb-6" style={{ letterSpacing: "0.24em" }}>
        More reporting
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
  const { isRead } = useReadStories();
  const dek = cardDek(item);
  const take = item.rubensNote?.trim() || item.sayThis?.trim();

  return (
    <article className={cn("min-w-0", className)}>
      <Link href={`/story/${item.id}`} className="bs-link block">
        <p
          className="font-mono uppercase mt-4"
          style={{ fontSize: "0.75rem", letterSpacing: "0.18em", color: colourFor(item.category) }}
        >
          {item.category}
          {isRead(item.id) ? " · Opened on this device" : ""}
          {item.source ? ` · ${item.source}` : ""} · {readingMinutes(item)} min
        </p>
        <h3
          className="font-serif font-bold mt-2.5"
          style={{
            fontSize: "clamp(1.375rem, 2.2vw, 1.75rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            textWrap: "pretty",
          }}
        >
          {cleanHeadline(item.title)}
        </h3>
      </Link>
      <div className="mt-3">
        <ThreadLink parentId={item.threadParentId} parentTitle={item.threadParentTitle} />
      </div>

      {dek && (
        <p
          className="mt-3"
          style={{ fontSize: "1.03125rem", lineHeight: 1.6, color: "var(--color-fg-muted)" }}
        >
          {dek.text}
        </p>
      )}

      {item.counterpoint?.trim() && (
        <details className="mt-4">
          <summary className="bs-label-accent cursor-pointer">The counterpoint</summary>
          <p className="text-sm leading-6 mt-2">{dedash(item.counterpoint.trim())}</p>
        </details>
      )}
      {take && (
        <p
          className="font-serif mt-4 pl-4"
          style={{
            fontSize: "1.1875rem",
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
