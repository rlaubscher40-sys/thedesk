/**
 * "More from today" card. Two-column grid member on lg+.
 *
 * Layout — the headline gets its full column width:
 *   ┌──────────────────────────────────────────────────┐
 *   │ CATEGORY · SOURCE                       ◫        │
 *   │                                                  │
 *   │ Headline runs the full width of the card         │
 *   │                                                  │
 *   │ Three-line dek paragraph...                      │
 *   │                                                  │
 *   │ SAY THIS — persona quote with actions            │
 *   │                                                  │
 *   │ ▾ Show context                                   │
 *   │                                                  │
 *   │ Partner angles                                   │
 *   │                                                  │
 *   │ Source · Read original                           │
 *   └──────────────────────────────────────────────────┘
 *
 * (The 96×96 thumbnail used to sit inside the title row and was the
 * reason headlines were breaking at narrow widths. It's gone.)
 */
import type { Story } from "@/data/editions/2026-05-15";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { usePersona } from "@/lib/persona";
import { BookmarkButton } from "./BookmarkButton";
import { ContextExpander } from "./ContextExpander";
import { PartnerAngles } from "./PartnerAngles";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";

export function StoryCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  const angle = story.partnerAngles.find((a) => a.persona === persona)
    ?? story.partnerAngles[0]!;

  return (
    <article
      className={cn(
        "panel hover-lift rounded-sm p-7 sm:p-8 flex flex-col h-full",
        categoryAccentClass(story.category)
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="overline"
            style={{ color: categoryColour(story.category), letterSpacing: "0.22em" }}
          >
            {story.category}
          </span>
          <span className="overline text-[var(--color-fg-subtle)]">·</span>
          <span className="overline text-[var(--color-fg-subtle)] truncate">
            {story.source}
          </span>
        </div>
        <BookmarkButton id={story.id} title={story.headline} />
      </div>

      <h3
        className="font-serif font-bold leading-[1.08] tracking-tight mb-4"
        style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)" }}
      >
        {story.headline}
      </h3>
      <p className="text-[15px] text-[var(--color-fg-muted)] leading-relaxed">
        {story.dek}
      </p>

      <SayThis story={story} persona={persona} sayThis={angle.sayThis} />

      {story.context && <ContextExpander note={story.context} />}

      <PartnerAngles angles={story.partnerAngles} />

      <SourceFooter
        source={story.source}
        sourceUrl={story.sourceUrl}
        category={story.category}
      />
    </article>
  );
}
