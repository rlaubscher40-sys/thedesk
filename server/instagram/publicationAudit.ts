import { z } from "zod";
import { sourceTimingSchema } from "../../shared/sourceTiming";
import { isEnrichedChannel } from "../../shared/const";
import { recentSocialReceipts, readSocialRecords } from "../db/socialPublication";
import { carouselStoryKey } from "./carouselStoryReceipt";
import { getFeedItemsByIds } from "../db/feed";
import { feedEnrichmentStates } from "../db/feedEnrichment";

const receipt = z.object({
  postId: z.string().regex(/^\d{1,64}$/),
  storyIds: z.array(z.number().int().positive().safe()).min(1).max(4),
  briefingVersion: z.literal("story-v2").optional(),
  storyFollowupVersion: z.literal(1).optional(),
  storyEvidence: z
    .array(
      z.object({
        id: z.number().int().positive().safe(),
        feedDate: z.string(),
        importedAt: z.string().datetime().nullable(),
        sourceTiming: sourceTimingSchema.nullable(),
      })
    )
    .max(4)
    .optional(),
});

/** Admin-only: exact receipt IDs, never guessed from today's top-ranked feed. */
export async function publicationAudit() {
  const receipts = (await recentSocialReceipts()).flatMap((row) => {
    if (!row.detail || row.detail.length > 8192) return [];
    try {
      const parsed = receipt.safeParse(JSON.parse(row.detail));
      return parsed.success ? [{ ...parsed.data, confirmedAt: row.finishedAt }] : [];
    } catch {
      return [];
    }
  });
  const ids = [...new Set(receipts.flatMap((row) => row.storyIds))];
  const [items, jobs] = await Promise.all([getFeedItemsByIds(ids), feedEnrichmentStates(ids)]);
  const storyKeys = receipts
    .filter((row) => row.storyFollowupVersion === 1)
    .flatMap((row) => row.storyIds.map((id) => carouselStoryKey(row.postId, id)));
  const storyRows = storyKeys.length ? await readSocialRecords(storyKeys) : [];
  return receipts.map((row) => ({
    mediaId: row.postId,
    briefingVersion: row.briefingVersion ?? null,
    confirmedAt: row.confirmedAt,
    stories: row.storyIds.map((id) => {
      const item = items.find((item) => item.id === id);
      const job = jobs.find((job) => job.feedItemId === id);
      const saved = storyRows.find((item) => item.jobKey === carouselStoryKey(row.postId, id));
      let storyMediaId: string | null = null;
      try {
        const detail = JSON.parse(saved?.detail ?? "null");
        if (
          saved?.status === "success" &&
          detail?.carouselId === row.postId &&
          detail?.sourceId === id &&
          typeof detail?.storyId === "string" &&
          /^\d{1,64}$/.test(detail.storyId)
        )
          storyMediaId = detail.storyId;
      } catch {
        /* Corrupt receipts are uncertainty, never success. */
      }
      return {
        id,
        companionStory: {
          state:
            row.storyFollowupVersion !== 1
              ? "not-tracked"
              : storyMediaId
                ? "confirmed"
                : saved
                  ? "uncertain"
                  : "not-confirmed",
          mediaId: storyMediaId,
          confirmedAt: storyMediaId ? saved!.finishedAt : null,
        },
        capturedAtPublication: row.storyEvidence?.find((story) => story.id === id) ?? null,
        currentRecord: item
          ? { feedDate: item.feedDate, importedAt: item.createdAt, sourceTiming: item.sourceTiming }
          : null,
        enrichment: job ?? {
          status: item && !isEnrichedChannel(item.channel) ? "not_required" : "unknown",
        },
      };
    }),
  }));
}
