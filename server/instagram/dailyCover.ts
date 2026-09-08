import type { DailyFeedItem } from "../db/schema";
import { renderDailyHookCoverCard } from "../og/dailyHookCover";

/** One cover layout and palette mapping for publication and source-copy preview. */
export function renderPropertyDailyCover(
  stories: DailyFeedItem[],
  variant: "navy" | "light",
  metrics?: Array<{ label: string; value: string }>
): Promise<Buffer> {
  const lead = stories[0];
  if (!lead) throw new Error("No property story for the cover");
  return renderDailyHookCoverCard({
    variant,
    feedDate: lead.feedDate,
    lead: {
      title: lead.title,
      category: lead.category,
      source: lead.source,
      whyItMatters: lead.whyItMatters,
    },
    supporting: stories.slice(1, 3).map(({ title, category }) => ({ title, category })),
    metrics,
  });
}
