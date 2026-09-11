import { ThreadLink } from "@/components/feed/ThreadLink";
/**
 * "More from today" — three hairline-divided columns.
 *
 * Each column: a 3:2 image, kicker, 28px headline, 16.5px summary, and the
 * Say This line as a one-line pull quote on a 3px accent rule. There is no
 * "Ruben's read" toggle: the take is the point of the card, so it renders
 * inline.
 *
 * Before the story grid, genuinely available counterpoints are compressed into
 * a small "What people are missing" plate. That makes the second-order read a
 * first-class product object rather than burying it inside individual stories.
 *
 * Ragged column heights are not a defect here — with hairline columns
 * instead of floating cards there is nothing to line up, which is why the
 * `estimatedCardHeight` sort that used to pre-order the grid is gone.
 */
import { ArrowRight } from "lucide-react";
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

function askCounterpointHref(item: DailyFeedItem): string {
  const counterpoint = dedash(item.counterpoint?.trim() ?? "").slice(0, 135);
  const question = `What does this counterpoint change about the story "${cleanHeadline(item.title)}": ${counterpoint}`;
  return `/ask?q=${encodeURIComponent(question.slice(0, 240))}`;
}

export function StoryColumns({ items }: { items: DailyFeedItem[] }) {
  if (items.length === 0) return null;

  const counterpoints = [...items]
    .filter((item) => Boolean(item.counterpoint?.trim()))
    .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50))
    .slice(0, 3);

  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-5")} aria-label="More from today">
      {counterpoints.length > 0 && (
        <div className="rule-hair-b pb-7 mb-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
                What people are missing
              </p>
              <h2
                className="font-serif font-bold mt-2"
                style={{
                  fontSize: "clamp(30px, 4vw, 48px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.035em",
                }}
              >
                The second-order read.
              </h2>
            </div>
            <p className="bs-label max-w-[44ch] text-right">
              Counterpoints only appear when the reporting supports a genuine second side.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 mt-6">
            {counterpoints.map((item, index) => (
              <article
                key={`counterpoint-${item.id}`}
                className={cn(
                  "py-4 lg:py-2 lg:pr-7",
                  index > 0 && "lg:rule-hair-l lg:pl-7"
                )}
              >
                <p className="bs-label-accent">{item.category}</p>
                <p
                  className="font-serif mt-2.5 text-[var(--color-fg-body)]"
                  style={{ fontSize: "clamp(20px, 2vw, 25px)", lineHeight: 1.32 }}
                >
                  {dedash(item.counterpoint?.trim() ?? "")}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
                  <Link href={`/story/${item.id}`} className="bs-label bs-link">
                    Underlying story
                  </Link>
                  <Link
                    href={askCounterpointHref(item)}
                    className="bs-label bs-link inline-flex items-center gap-1.5"
                  >
                    Interrogate this angle <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

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
        <div className="mt-3"><ThreadLink parentId={item.threadParentId} parentTitle={item.threadParentTitle} /></div>

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
