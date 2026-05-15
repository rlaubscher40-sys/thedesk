/**
 * Featured story — front-page lead. Full-width card with a left coloured
 * accent bar matching the story's category, larger headline, full dek,
 * SAY THIS quote block, expandable analyst-note context, partner-angles
 * list, and a source-attribution footer.
 *
 * Active persona is read from context; the corresponding angle is the
 * highlighted partner-angle row and its sayThis is the one rendered.
 */
import { Linkedin } from "lucide-react";
import { useState } from "react";
import type { Story } from "@/data/editions/2026-05-15";
import { categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { usePersona } from "@/lib/persona";
import { BookmarkButton } from "./BookmarkButton";
import { ContextExpander } from "./ContextExpander";
import { FeaturedPill } from "./CategoryPill";
import { NoAngleNote } from "./NoAngleNote";
import { PartnerAngles } from "./PartnerAngles";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";

export function FeaturedCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  // Only show a Say This when the active persona has an angle on this
  // story. If a "trending" / culture / sport item doesn't apply to
  // (say) SMSF specialists, we don't fabricate a forced angle —
  // we hide the partner block entirely.
  const angle = story.partnerAngles.find((a) => a.persona === persona);
  const colour = categoryColour(story.category);
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  return (
    <article
      className="panel rounded-sm relative overflow-hidden hover-lift"
      style={{ boxShadow: `inset 3px 0 0 0 ${colour}` }}
    >
      <div className="p-8 sm:p-12 lg:p-16">
        {/* Editorial mast — FEATURED · CATEGORY double-pill + actions. */}
        <div className="flex items-start justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <FeaturedPill category={story.category} />
            {story.readingTime && (
              <>
                <span
                  className="block h-3 w-px bg-[var(--color-border-strong)]"
                  aria-hidden="true"
                />
                <span className="overline text-[var(--color-fg-subtle)]">
                  {story.readingTime}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 -mr-1.5">
            <BookmarkButton id={story.id} title={story.headline} />
            <button
              onClick={() => setLinkedInOpen((v) => !v)}
              aria-label="Share to LinkedIn"
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
            >
              <Linkedin className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Headline — display-2 scale. */}
        <h2 className="display-2 mb-7 max-w-[28ch]">{story.headline}</h2>

        {/* Dek. */}
        <p className="font-serif italic text-lg sm:text-xl text-[var(--color-fg-muted)] leading-relaxed max-w-[68ch]">
          {story.dek}
        </p>

        {angle ? (
          <SayThis story={story} persona={persona} sayThis={angle.sayThis} />
        ) : (
          <NoAngleNote persona={persona} />
        )}

        {story.context && <ContextExpander note={story.context} />}

        {story.partnerAngles.length > 0 && (
          <PartnerAngles angles={story.partnerAngles} />
        )}

        <SourceFooter
          source={story.source}
          sourceUrl={story.sourceUrl}
          category={story.category}
        />

        {linkedInOpen && (
          <p
            role="status"
            className={cn(
              "mt-4 text-xs text-[var(--color-fg-muted)] border-l-2 pl-3",
              "border-[var(--color-border-strong)]"
            )}
          >
            Use the Share button on the Say This block — it copies the line and opens LinkedIn.
          </p>
        )}
      </div>
    </article>
  );
}
