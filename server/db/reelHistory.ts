import { and, eq, inArray, sql } from "drizzle-orm";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { jobRuns } from "./schema";

/** Confirmed publications across reference periods, not delivery attempts.
 * One bounded result per registered key; no new watermark or publication write. */
export async function readReelPublicationHistory(keys: string[]) {
  if (!keys.length) return [];
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("The durable Reel history is unavailable.");
  const rows = await db
    .select({
      key: jobRuns.jobKey,
      publishedAt:
        sql<number>`max(unix_timestamp(coalesce(${jobRuns.finishedAt}, ${jobRuns.startedAt}))) * 1000`.mapWith(
          Number
        ),
    })
    .from(jobRuns)
    .where(
      and(
        inArray(jobRuns.jobKey, [...new Set(keys)]),
        eq(jobRuns.status, "success"),
        sql`${jobRuns.detail} regexp '^Published media [0-9]+$'`
      )
    )
    .groupBy(jobRuns.jobKey);
  return rows.map((row) => ({ key: row.key, publishedAt: new Date(row.publishedAt) }));
}
