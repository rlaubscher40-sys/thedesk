/**
 * Tiny source-attribution footer for desk cards. Renders a category-coloured
 * glyph chip + source name + "Read original →" link. The glyph stands in
 * for a real favicon, colour keyed to the story's category so the eye
 * picks it out at a glance.
 */
import { ExternalLink } from "lucide-react";
import { categoryColour } from "@/lib/category";
import type { Category } from "@/data/editions/2026-05-15";

export function SourceFooter({
  source,
  sourceUrl,
  category,
}: {
  source: string;
  sourceUrl: string;
  category: Category;
}) {
  const colour = categoryColour(category);
  const initial = source[0]?.toUpperCase() ?? "·";
  return (
    <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="h-6 w-6 rounded shrink-0 flex items-center justify-center font-mono text-xs"
          style={{
            background: `${colour}18`,
            color: colour,
            boxShadow: `inset 0 0 0 1px ${colour}55`,
          }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="text-sm text-[var(--color-fg-muted)] truncate">{source}</span>
      </div>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors"
      >
        Read original
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
