import { and, eq, sql } from "drizzle-orm";
import { REVIEWED_METRIC_CORRECTIONS } from "../../shared/reviewedMetricCorrections";
import { getDb } from "./client";
import { dailyMetrics } from "./schema";

/** Repair only the exact observed source/period/value/context combination.
 * No collection is claimed, no old history is relabelled, and no job is reset. */
export async function applyReviewedMetricCorrections() {
  const db = getDb();
  if (!db) throw new Error("Reviewed metric corrections require a database");
  for (const correction of REVIEWED_METRIC_CORRECTIONS) {
    await db
      .update(dailyMetrics)
      .set({ ...correction.after, previousValue: null })
      .where(
        and(
          eq(dailyMetrics.metricKey, correction.metricKey),
          eq(dailyMetrics.asOf, new Date(correction.asOf)),
          eq(dailyMetrics.source, "ABS"),
          sql`CAST(${dailyMetrics.sourceUrl} AS BINARY) = CAST(${correction.sourceUrl} AS BINARY)`,
          sql`CAST(${dailyMetrics.value} AS BINARY) = CAST(${correction.before.value} AS BINARY)`,
          sql`CAST(${dailyMetrics.context} AS BINARY) = CAST(${correction.before.context} AS BINARY)`
        )
      );
  }
}
