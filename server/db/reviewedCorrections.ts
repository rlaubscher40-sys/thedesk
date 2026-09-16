import { and, eq, sql } from "drizzle-orm";
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
            sql`CAST(${dailyFeedItems.sourceUrl} AS BINARY) = CAST(${correction.sourceUrl} AS BINARY)`,
            sql`CAST(${dailyFeedItems[change.field]} AS BINARY) = CAST(${change.before} AS BINARY)`
          )
        );
    }
  }
}
