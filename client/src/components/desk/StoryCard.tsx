/**
 * "More from today" card. 2-up grid member.
 *
 * Layout: category tag + bookmark on top, then a row with the editorial
 * column on the left (headline + 3-line dek) and a 96×96 thumbnail on
 * the right. Below: SAY THIS block for the active persona, Show context
 * expander, Partner Angles, source footer.
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
import { Thumbnail } from "./Thumbnail";

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
      <div className="flex items-start justify-between gap-3 mb-5">
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

      <div className="flex gap-5 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="display-3 leading-tight mb-3 line-clamp-3">{story.headline}</h3>
          <p className="text-[15px] text-[var(--color-fg-muted)] leading-relaxed line-clamp-3">
            {story.dek}
          </p>
        </div>
        <Thumbnail seed={story.id} category={story.category} />
      </div>

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
