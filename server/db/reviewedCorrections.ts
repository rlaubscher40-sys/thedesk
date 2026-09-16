import { and, eq } from "drizzle-orm";
import { REVIEWED_STORY_CORRECTIONS } from "../../shared/reviewedStoryCorrections";
import { getDb } from "./client";
import { dailyFeedItems } from "./schema";

/** Bounded, idempotent source corrections. Match ID, original URL and exact
 * observed field together; never overwrite a later editorial change. */
export async function applyReviewedStoryCorrections() {
  const db = getDb();
  if (!db) return;
  for (const correction of REVIEWED_STORY_CORRECTIONS) {
    for (const change of correction.fields) {
      await db
        .update(dailyFeedItems)
        .set({ [change.field]: change.after })
        .where(
          and(
            eq(dailyFeedItems.id, correction.id),
            eq(dailyFeedItems.sourceUrl, correction.sourceUrl),
            eq(dailyFeedItems[change.field], change.before)
          )
        );
    }
  }
}
