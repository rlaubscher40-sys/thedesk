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
import { and, desc, gte, isNull, eq, count } from "drizzle-orm";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  instagramPosts,
  type InsertInstagramPost,
  type InstagramPost,
} from "./schema";

export type InstagramPostMetrics = {
  likes?: number | null;
  comments?: number | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
  totalInteractions?: number | null;
};

/** Insert a published post. Idempotent on mediaId; never throws. */
export async function recordInstagramPost(
  input: Pick<
    InsertInstagramPost,
    "mediaId" | "postType" | "feedDate" | "editionNumber" | "headline"
  >
): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(instagramPosts).values(input);
  } catch (err) {
    // Duplicate mediaId or missing table (pre-migration): log and move on.
    console.warn(
      `[instagramPosts] record skipped for ${input.mediaId}:`,
      (err as Error).message
    );
  }
}

/**
 * Posts published within the last `withinDays` whose metrics have not been
 * fetched yet. The insights job runs daily and picks up the prior day's post.
 */
export async function listInstagramPostsNeedingMetrics(
  withinDays = 7
): Promise<InstagramPost[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(instagramPosts)
      .where(
        and(
          isNull(instagramPosts.metricsFetchedAt),
          gte(instagramPosts.createdAt, since)
        )
      )
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
    console.warn(
      `[instagramPosts] metrics update failed for ${mediaId}:`,
      (err as Error).message
    );
  }
}

/** Recent posts, newest first. For reporting / admin. */
export async function listInstagramPosts(limit = 30): Promise<InstagramPost[]> {
  if (isDemoMode()) return [];
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

/**
 * How many posts of a given type have been published. Drives the navy/light
 * cover alternation: counting by post order (rather than by date) keeps the
 * profile-grid checkerboard intact even when a day is skipped. Returns 0 on
 * any failure so a count hiccup never blocks a post.
 */
export async function countInstagramPosts(postType?: string): Promise<number> {
  if (isDemoMode()) return 0;
  const db = getDb();
  if (!db) return 0;
  try {
    const rows = await db
      .select({ n: count() })
      .from(instagramPosts)
      .where(postType ? eq(instagramPosts.postType, postType) : undefined);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
