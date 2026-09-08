/**
 * Persistence for published Instagram feed posts and their engagement metrics.
 *
 * recordInstagramPost            — called right after a post publishes.
 * listInstagramPostsNeedingMetrics — mature posts needing a complete snapshot.
 * updateInstagramPostMetrics     — backfills metrics from the insights job.
 * listInstagramPosts             — recent posts, newest first (for reporting).
 *
 * All writes are best-effort: if the table does not exist yet (the migration
 * has not been applied) or the DB is unavailable, these no-op rather than throw,
 * so posting is never blocked by analytics.
 */
import { and, desc, gte, lte, inArray, isNotNull, eq } from "drizzle-orm";
import {
  INSIGHT_BATCH_LIMIT,
  INSIGHT_MIN_AGE_HOURS,
  INSIGHT_RETRY_DAYS,
  INSIGHT_FIELDS,
  needsInsightRefresh,
  validMetricCount,
} from "../../shared/instagramMeasurement";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { INSTAGRAM_POST_TYPES, type InstagramPostType } from "../../shared/const";
import { instagramPosts, type InsertInstagramPost, type InstagramPost } from "./schema";

export type InstagramPostMetrics = {
  likes?: number | null;
  comments?: number | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
  totalInteractions?: number | null;
};

/**
 * Insert a published post. Idempotent on mediaId; never throws.
 *
 * `postType` is narrowed from the schema's plain string to the shared union,
 * so a new kind of post cannot be recorded without first being added to
 * INSTAGRAM_POST_TYPES — which is what the grid flip and the admin panel read.
 */
export async function recordInstagramPost(
  input: Pick<
    InsertInstagramPost,
    "mediaId" | "feedDate" | "editionNumber" | "headline" | "coverVariant"
  > & { postType: InstagramPostType }
): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(instagramPosts).values(input);
  } catch (err) {
    // Duplicate mediaId or missing table (pre-migration): log and move on.
    console.warn(`[instagramPosts] record skipped for ${input.mediaId}:`, (err as Error).message);
  }
}

/**
 * Mature posts awaiting a complete first-day snapshot. Early/partial readings
 * can recover for seven days; late recovery stays out of format comparisons.
 */
export async function listInstagramPostsNeedingMetrics(
  withinDays = INSIGHT_RETRY_DAYS
): Promise<InstagramPost[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const now = new Date();
    const since = new Date(
      now.getTime() - Math.min(INSIGHT_RETRY_DAYS, Math.max(1, withinDays)) * 86_400_000
    );
    const mature = new Date(now.getTime() - INSIGHT_MIN_AGE_HOURS * 3_600_000);
    const rows = await db
      .select()
      .from(instagramPosts)
      .where(and(gte(instagramPosts.createdAt, since), lte(instagramPosts.createdAt, mature)))
      .orderBy(desc(instagramPosts.createdAt))
      .limit(200);
    return rows.filter((row) => needsInsightRefresh(row, now)).slice(0, INSIGHT_BATCH_LIMIT);
  } catch (err) {
    console.warn("[instagramPosts] needing-metrics query failed:", (err as Error).message);
    return [];
  }
}

/** Backfill engagement metrics for a post. Never throws. */
export async function updateInstagramPostMetrics(
  mediaId: string,
  metrics: InstagramPostMetrics
): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  // Never erase a prior snapshot when both provider reads failed. Partial
  // snapshots replace all fields together so different observation ages cannot mix.
  const snapshot = Object.fromEntries(
    INSIGHT_FIELDS.map((key) => [key, validMetricCount(metrics[key]) ? metrics[key] : null])
  );
  if (!Object.values(snapshot).some(validMetricCount)) return;
  try {
    await db
      .update(instagramPosts)
      .set({ ...snapshot, metricsFetchedAt: new Date() })
      .where(eq(instagramPosts.mediaId, mediaId));
  } catch (err) {
    console.warn(`[instagramPosts] metrics update failed for ${mediaId}:`, (err as Error).message);
  }
}

/**
 * The navy/light tone of the newest post on the profile grid, so the next post
 * can flip from it and keep the 3-wide grid reading as a checkerboard.
 *
 * Reads across every post type rather than matching like with like: the grid
 * interleaves them chronologically, so what matters is the tile immediately
 * before this one, whatever kind of post it was.
 */
export async function latestGridCoverVariant(): Promise<"navy" | "light" | null> {
  if (isDemoMode()) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ coverVariant: instagramPosts.coverVariant })
      .from(instagramPosts)
      .where(
        and(
          inArray(instagramPosts.postType, [...INSTAGRAM_POST_TYPES]),
          isNotNull(instagramPosts.coverVariant)
        )
      )
      .orderBy(desc(instagramPosts.createdAt))
      .limit(1);
    const v = rows[0]?.coverVariant;
    return v === "navy" || v === "light" ? v : null;
  } catch (err) {
    console.warn("[instagramPosts] latest cover variant query failed:", (err as Error).message);
    return null;
  }
}

/** Recent posts, newest first. For reporting / admin. */
export async function listInstagramPosts(limit = 30): Promise<InstagramPost[]> {
  // Demo mode serves the seed so the admin panel's format comparison can be
  // reviewed without a live account behind it.
  if (isDemoMode()) return demoQueries.listInstagramPosts(limit);
  const db = getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(instagramPosts)
      .orderBy(desc(instagramPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
