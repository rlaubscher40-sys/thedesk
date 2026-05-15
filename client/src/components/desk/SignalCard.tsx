/**
 * "Further signals" card. Single-column, wide. Lighter weight than the
 * featured / more cards — no Partner Angles list, smaller thumbnail.
 *
 * Two-column inside: editorial column left, small 56×56 thumbnail
 * mounted in the top-right.
 */
import type { Story } from "@/data/editions/2026-05-15";
import { categoryAccentClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { usePersona } from "@/lib/persona";
import { BookmarkButton } from "./BookmarkButton";
import { CategoryPill } from "./CategoryPill";
import { CuratorByline } from "./CuratorByline";
import { NoAngleNote } from "./NoAngleNote";
import { PaywallHint } from "./PaywallHint";
import { SayThis } from "./SayThis";
import { SourceFooter } from "./SourceFooter";
import { Thumbnail } from "./Thumbnail";

export function SignalCard({ story }: { story: Story }) {
  const { persona } = usePersona();
  const angle = story.partnerAngles.find((a) => a.persona === persona);

  return (
    <article
      className={cn(
        "panel hover-lift rounded-sm p-7 sm:p-8",
        categoryAccentClass(story.category)
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <CategoryPill category={story.category} variant="ghost" />
        <div className="flex items-start gap-2 shrink-0">
          <Thumbnail seed={story.id} category={story.category} size={56} />
          <BookmarkButton id={story.id} title={story.headline} />
        </div>
      </div>

      <h3 className="font-serif font-bold text-xl sm:text-2xl leading-snug mb-3 max-w-[60ch]">
        {story.headline}
      </h3>
      <p className="text-[15px] text-[var(--color-fg-muted)] leading-relaxed max-w-[78ch]">
        {story.dek}
      </p>

      {angle ? (
        <SayThis story={story} persona={persona} sayThis={angle.sayThis} />
      ) : (
        <NoAngleNote persona={persona} />
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
