/**
 * Rough "N min read" estimate for a feed item. Counts the words across every
 * text block the story page actually renders (headline, summary, the
 * analytical lines, the partner angle) so the figure reflects the full read,
 * not just the clamped card dek. Floored at 1 minute.
 */
import type { DailyFeedItem } from "@shared/types";

const WORDS_PER_MINUTE = 220;

type ReadableParts = Pick<
  DailyFeedItem,
  "title" | "summary" | "whyItMatters" | "sayThis" | "counterpoint" | "partnerTag"
>;

export function readingMinutes(item: ReadableParts): number {
  const text = [
    item.title,
    item.summary,
    item.whyItMatters,
    item.sayThis,
    item.counterpoint,
    item.partnerTag,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text) return 1;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
