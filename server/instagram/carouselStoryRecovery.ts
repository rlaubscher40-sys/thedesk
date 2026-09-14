import { z } from "zod";
import { env } from "../core/env";
import { recentSocialReceipts, readSocialRecords } from "../db/socialPublication";
import { getFeedItemsByIds } from "../db/feed";
import { carouselStoryKey } from "./carouselStoryReceipt";
import { assessBriefingStory } from "./briefingSelection";
import { sourceGroundedStory } from "./sourceContent";
import { instagramCooldownActive, postStoryFrames } from "./post";

const receiptSchema = z.object({
  postId: z.string().regex(/^\d{1,64}$/),
  storyIds: z.array(z.number().int().positive().safe()).min(1).max(3),
  briefingVersion: z.literal("story-v2"),
  storyFollowupVersion: z.literal(1),
  coverVariant: z.enum(["navy", "light"]),
});

/** Bounded scheduled recovery of tracked daily follow-ups only. No carousel
 * replay, no legacy/weekly backfill and no release of uncertain Story claims. */
export async function recoverCarouselStories(now = new Date()): Promise<void> {
  if (!env.instagramAccessToken || !env.instagramBusinessAccountId || instagramCooldownActive())
    return;
  for (const row of await recentSocialReceipts(now)) {
    const age = now.getTime() - (row.finishedAt?.getTime() ?? NaN);
    if (!Number.isFinite(age) || age < 10 * 60_000 || age > 24 * 60 * 60_000) continue;
    let value: unknown;
    try {
      value = JSON.parse(row.detail ?? "");
    } catch {
      continue;
    }
    const parsed = receiptSchema.safeParse(value);
    if (!parsed.success) continue;
    const receipt = parsed.data;
    const keys = receipt.storyIds.map((id) => carouselStoryKey(receipt.postId, id));
    const used = new Set((await readSocialRecords(keys)).map((record) => record.jobKey));
    const missing = receipt.storyIds.filter(
      (id) => !used.has(carouselStoryKey(receipt.postId, id))
    );
    if (!missing.length) continue;
    const items = await getFeedItemsByIds(missing);
    const stories = missing.flatMap((id) => {
      const item = items.find((story) => story.id === id);
      return item && !assessBriefingStory(item).hold ? [sourceGroundedStory(item)] : [];
    });
    if (!stories.length) continue;
    console.log(
      `[carousel-story-recovery] carousel ${receipt.postId}: ${stories.length} missing frames`
    );
    await postStoryFrames({
      carouselId: receipt.postId,
      stories,
      variant: receipt.coverVariant,
      verticalOpts: {},
      siteUrl: (process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "https://thedesk.au").replace(
        /\/+$/,
        ""
      ),
      igUserId: env.instagramBusinessAccountId,
      accessToken: env.instagramAccessToken,
    });
    return; // At most one confirmed carousel / three spaced frames per job.
  }
}
