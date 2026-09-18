import { Link } from "wouter";
import { guideForStory } from "@shared/propertyGuides";

export function GuideContext({ title, channel }: { title: string; channel?: string | null }) {
  const guide = guideForStory(title, channel);
  if (!guide) return null;
  return (
    <aside className="rule-hair mt-8 pt-5" aria-label="Understand the context">
      <p className="bs-label-accent">Property explained</p>
      <Link
        href={`/guides/${guide.slug}`}
        className="bs-link block font-serif text-2xl font-bold mt-3"
      >
        {guide.title} →
      </Link>
      <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">{guide.intro}</p>
    </aside>
  );
}
