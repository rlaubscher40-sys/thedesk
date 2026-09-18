import { and, eq, sql } from "drizzle-orm";
import { REVIEWED_STORY_CORRECTIONS } from "../../shared/reviewedStoryCorrections";
import { cleanReportingExcerpt } from "../../shared/reportingExcerpt";
import { getDb } from "./client";
import { dailyFeedItems } from "./schema";

/** Bounded, idempotent source corrections. Match ID, original URL and exact
 * observed field together; never overwrite a later editorial change. */
export async function applyReviewedStoryCorrections() {
  const db = getDb();
  if (!db) return;
  for (const correction of REVIEWED_STORY_CORRECTIONS) {
    for (const change of correction.fields) {
      let priorValue: string = change.before;
      if ("matchPublicExcerpt" in change && change.matchPublicExcerpt) {
        // This explicitly marked correction was reviewed from the public view.
        // Match its exact cleaned text, then compare-and-swap the archived bytes
        // so a concurrent edit cannot be overwritten. No fuzzy text matching.
        const [row] = await db.select({ summary: dailyFeedItems.summary })
          .from(dailyFeedItems)
          .where(and(
            eq(dailyFeedItems.id, correction.id),
            sql`CAST(${dailyFeedItems.sourceUrl} AS BINARY) = CAST(${correction.sourceUrl} AS BINARY)`
          )).limit(1);
        if (!row?.summary || cleanReportingExcerpt(row.summary) !== change.before) continue;
        priorValue = row.summary;
      }
      await db
        .update(dailyFeedItems)
        .set({ [change.field]: change.after })
        .where(
          and(
            eq(dailyFeedItems.id, correction.id),
            sql`CAST(${dailyFeedItems.sourceUrl} AS BINARY) = CAST(${correction.sourceUrl} AS BINARY)`,
            sql`CAST(${dailyFeedItems[change.field]} AS BINARY) = CAST(${priorValue} AS BINARY)`
          )
        );
    }
  }
}
