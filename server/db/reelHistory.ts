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
  // Rank whole receipts, not individual columns: MAX(detail) could attach a
  // different media ID/reference period to the most recent publication time.
  const ranked = db
    .select({
      key: jobRuns.jobKey,
      date: jobRuns.runDate,
      detail: jobRuns.detail,
      publishedAt:
        sql<number>`unix_timestamp(coalesce(${jobRuns.finishedAt}, ${jobRuns.startedAt})) * 1000`
          .mapWith(Number)
          .as("published_at"),
      position: sql<number>`row_number() over (
        partition by ${jobRuns.jobKey}
        order by coalesce(${jobRuns.finishedAt}, ${jobRuns.startedAt}) desc,
          ${jobRuns.runDate} desc, ${jobRuns.detail} desc
      )`.as("receipt_position"),
    })
    .from(jobRuns)
    .where(
      and(
        inArray(jobRuns.jobKey, [...new Set(keys)]),
        eq(jobRuns.status, "success"),
        sql`${jobRuns.detail} regexp '^Published media [0-9]+$'`
      )
    )
    .as("ranked_reel_receipts");
  const rows = await db.select().from(ranked).where(eq(ranked.position, 1));
  return rows.map((row) => {
    const postId = row.detail?.match(/^Published media (\d+)$/)?.[1];
    if (!postId || !Number.isFinite(row.publishedAt) || row.publishedAt <= 0)
      throw new Error("The durable Reel receipt is invalid.");
    return { key: row.key, date: row.date, postId, publishedAt: new Date(row.publishedAt) };
  });
}
