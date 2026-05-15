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
        "panel hover-lift rounded p-6 flex flex-col sm:flex-row gap-6",
        categoryAccentClass(story.category)
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="overline-amber"
              style={{ color: categoryColour(story.category), letterSpacing: "0.2em" }}
            >
              {story.category}
            </span>
            <span className="overline">·</span>
            <span className="overline truncate">{story.source}</span>
          </div>
          <BookmarkButton id={story.id} title={story.headline} />
        </div>

        <h3 className="font-serif text-xl leading-snug mb-2">{story.headline}</h3>
        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{story.dek}</p>

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
