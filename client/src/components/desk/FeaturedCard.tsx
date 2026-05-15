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
import { PartnerAngles } from "./PartnerAngles";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";

export function FeaturedCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  const angle = story.partnerAngles.find((a) => a.persona === persona)
    ?? story.partnerAngles[0]!;
  const colour = categoryColour(story.category);
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  return (
    <article
      className="panel rounded relative overflow-hidden hover-lift"
      style={{ boxShadow: `inset 4px 0 0 0 ${colour}` }}
    >
      <div className="p-7 sm:p-9 lg:p-10">
        {/* Metadata + actions. */}
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span
              className="overline-amber"
              style={{ color: colour, letterSpacing: "0.22em" }}
            >
              {story.category}
            </span>
            <span className="overline">·</span>
            <span className="overline">Featured</span>
            {story.readingTime && (
              <>
                <span className="overline">·</span>
                <span className="overline">{story.readingTime}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 -mr-1.5">
            <BookmarkButton id={story.id} title={story.headline} />
            <button
              onClick={() => setLinkedInOpen((v) => !v)}
              aria-label="Share to LinkedIn"
              className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
            >
              <Linkedin className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Headline. */}
        <h2 className="display-2 mb-5">{story.headline}</h2>

        {/* Dek — italic serif, generous max-w for legibility. */}
        <p className="font-serif italic text-lg text-[var(--color-fg-muted)] leading-relaxed max-w-[68ch]">
          {story.dek}
        </p>

        {/* Read original is repeated up top as a quick link; full source
            footer lives at the bottom. */}
        <a
          href={story.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 overline-amber mt-5 hover:text-amber-200 transition-colors"
        >
          Read original →
        </a>

        <SayThis story={story} persona={persona} sayThis={angle.sayThis} />

        {story.context && <ContextExpander note={story.context} />}

        <PartnerAngles angles={story.partnerAngles} />

        <SourceFooter
          source={story.source}
          sourceUrl={story.sourceUrl}
          category={story.category}
        />

        {/* Optional inline LinkedIn-share confirmation note. */}
        {linkedInOpen && (
          <p
            role="status"
            className={cn(
              "mt-4 text-xs text-[var(--color-fg-muted)] border-l-2 pl-3",
              "border-amber-400/40"
            )}
          >
            Use the Share button in the Say This block — it copies the line and opens LinkedIn for you.
          </p>
        )}
      </div>
    </article>
  );
}
