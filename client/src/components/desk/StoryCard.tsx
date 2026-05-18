/**
 * "More from today" card. Two-column grid member on md+.
 *
 * Top row carries the category pill on the left and a small 72×72
 * thumbnail + bookmark on the right. Headline sits BELOW that row
 * so it gets the full card width and never wraps awkwardly into
 * the thumbnail.
 */
import type { Story } from "@/data/editions/2026-05-15";
import { categoryAccentClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { usePersona } from "@/lib/persona";
import { BookmarkButton } from "./BookmarkButton";
import { CategoryPill } from "./CategoryPill";
import { ContextExpander } from "./ContextExpander";
import { CuratorByline } from "./CuratorByline";
import { NoAngleNote } from "./NoAngleNote";
import { PartnerAngles } from "./PartnerAngles";
import { PaywallHint } from "./PaywallHint";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";
import { Thumbnail } from "./Thumbnail";

export function StoryCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  const angle = story.partnerAngles.find((a) => a.persona === persona);

  return (
    <article
      className={cn(
        "panel hover-lift rounded-sm p-7 sm:p-8 flex flex-col h-full",
        categoryAccentClass(story.category)
      )}
    >
      {/* Top row, pill on the left, thumbnail + bookmark on the right. */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <CategoryPill category={story.category} />
        <div className="flex items-start gap-2 shrink-0">
          <Thumbnail seed={story.id} category={story.category} size={72} />
          <BookmarkButton id={story.id} title={story.headline} />
        </div>
      </div>

      <h3
        className="font-serif font-bold leading-[1.08] tracking-tight mb-4"
        style={{ fontSize: "clamp(1.55rem, 2.1vw, 1.95rem)" }}
      >
        {story.headline}
      </h3>
      <p className="text-[15px] text-[var(--color-fg-muted)] leading-relaxed">
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

      {story.tier === "paid" && <PaywallHint />}

      <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
        <CuratorByline />
      </div>

      <SourceFooter
        source={story.source}
        sourceUrl={story.sourceUrl}
        category={story.category}
      />
    </article>
  );
}
