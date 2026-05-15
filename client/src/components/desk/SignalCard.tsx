/**
 * "Further signals" card. Single-column, wide, lighter weight — no
 * partner-angles list, but the active persona's Say This is still
 * surfaced inline.
 */
import type { Story } from "@/data/editions/2026-05-15";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { usePersona } from "@/lib/persona";
import { BookmarkButton } from "./BookmarkButton";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";

export function SignalCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  const angle = story.partnerAngles.find((a) => a.persona === persona)
    ?? story.partnerAngles[0]!;

  return (
    <article
      className={cn(
        "panel hover-lift rounded-sm p-7 sm:p-8 flex flex-col sm:flex-row gap-7",
        categoryAccentClass(story.category)
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
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

        <h3 className="font-serif text-xl sm:text-2xl leading-snug mb-3 max-w-[40ch]">
          {story.headline}
        </h3>
        <p className="text-[15px] text-[var(--color-fg-muted)] leading-relaxed max-w-[68ch]">
          {story.dek}
        </p>

        <SayThis story={story} persona={persona} sayThis={angle.sayThis} />

        <SourceFooter
          source={story.source}
          sourceUrl={story.sourceUrl}
          category={story.category}
        />
      </div>
    </article>
  );
}
