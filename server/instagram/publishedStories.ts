import { z } from "zod";
import { recentSocialReceipts } from "../db/socialPublication";
import { getFeedItemsByIds } from "../db/feed";
import { propertyStoryTier } from "./propertyEditorial";
import { storyDestination } from "./sourceContent";

const receiptSchema = z.object({
  postId: z.string().regex(/^\d{1,64}$/),
  storyIds: z.array(z.number().int().positive().safe()).min(1).max(4),
});

/** References are captured at confirmation, never reconstructed from today's rankings. */
export async function publishedSocialStories(
  readReceipts = recentSocialReceipts,
  readStories = getFeedItemsByIds,
  now = new Date()
) {
  const receipts = (await readReceipts(now)).slice(0, 12).flatMap((row) => {
    if (
      !row.finishedAt ||
      !Number.isFinite(row.finishedAt.getTime()) ||
      row.finishedAt > now ||
      row.finishedAt.getTime() < now.getTime() - 30 * 86400000 ||
      !row.detail ||
      row.detail.length > 4096
    )
      return [];
    try {
      const parsed = receiptSchema.safeParse(JSON.parse(row.detail));
      return parsed.success ? [{ ...parsed.data, publishedAt: row.finishedAt }] : [];
    } catch {
      return [];
    }
  });
  if (!receipts.length) return [];
  const ids = [...new Set(receipts.flatMap((r) => r.storyIds))];
  const rows = await readStories(ids);
  const stories = new Map(
    rows
      .filter((row) => ids.includes(row.id) && propertyStoryTier(row) > 0)
      .map((row) => [row.id, row])
  );
  const seen = new Set<number>();
  return receipts
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .flatMap((receipt) =>
      receipt.storyIds.flatMap((id) => {
        const story = stories.get(id);
        if (!story || seen.has(id)) return [];
        seen.add(id);
        return [
          {
            id,
            title: story.title,
            source: story.source,
            publishedAt: receipt.publishedAt,
            path: storyDestination(story),
          },
        ];
      })
    )
    .slice(0, 6);
}
