/**
 * Persistence for published Instagram feed posts and their engagement metrics.
 *
 * recordInstagramPost            — called right after a post publishes.
 * listInstagramPostsNeedingMetrics — posts whose metrics haven't been fetched.
 * updateInstagramPostMetrics     — backfills metrics from the insights job.
 * listInstagramPosts             — recent posts, newest first (for reporting).
 *
 * All writes are best-effort: if the table does not exist yet (the migration
 * has not been applied) or the DB is unavailable, these no-op rather than throw,
 * so posting is never blocked by analytics.
 */
import { and, count, desc, gte, inArray, isNotNull, isNull, eq } from "drizzle-orm";
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
 * Posts published within the last `withinDays` whose metrics have not been
 * fetched yet. The insights job runs daily and picks up the prior day's post.
 */
export async function listInstagramPostsNeedingMetrics(withinDays = 7): Promise<InstagramPost[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(instagramPosts)
      .where(and(isNull(instagramPosts.metricsFetchedAt), gte(instagramPosts.createdAt, since)))
      .orderBy(desc(instagramPosts.createdAt));
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
  try {
    await db
      .update(instagramPosts)
      .set({ ...metrics, metricsFetchedAt: new Date() })
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
