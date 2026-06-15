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
    "mediaId" | "postType" | "feedDate" | "editionNumber" | "headline" | "coverVariant"
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

/**
 * How many posts of a given type have been published. Drives the daily
 * cover's navy/light alternation: slide 1 is the profile-grid thumbnail, so
 * flipping the variant on each successive daily post makes the 3-wide grid
 * read as a checkerboard. Returns 0 on any error (or pre-migration), which
 * keeps the next post on the default "navy" rather than blocking it.
 */
export async function countInstagramPosts(postType: string): Promise<number> {
  if (isDemoMode()) return 0;
  const db = getDb();
  if (!db) return 0;
  try {
    const rows = await db
      .select({ value: count() })
      .from(instagramPosts)
      .where(eq(instagramPosts.postType, postType));
    return rows[0]?.value ?? 0;
  } catch (err) {
    console.warn("[instagramPosts] count query failed:", (err as Error).message);
    return 0;
  }
}

/**
 * How many posts share the alternating navy/light grid cover. The daily
 * ("Today's Briefing") and coverage ("The Wider Lens") posts both use that
 * cover and now publish twice a day, so the checkerboard only stays clean if
 * we alternate across BOTH streams combined — counting "daily" alone left the
 * coverage post on the same colour as that morning's daily post.
 */
export async function countCheckerboardPosts(): Promise<number> {
  if (isDemoMode()) return 0;
  const db = getDb();
  if (!db) return 0;
  try {
    const rows = await db
      .select({ value: count() })
      .from(instagramPosts)
      .where(inArray(instagramPosts.postType, ["daily", "coverage"]));
    return rows[0]?.value ?? 0;
  } catch (err) {
    console.warn("[instagramPosts] checkerboard count failed:", (err as Error).message);
    return 0;
  }
}

/**
 * The grid cover tone of the most recent daily/coverage/weekly post that has
 * one recorded. The next post flips from this so the profile checkerboard stays
 * clean across all three streams (the weekly no longer breaks the rhythm).
 * Returns null pre-migration or when no prior post carries a tone — the caller
 * picks a default to start the pattern.
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
          inArray(instagramPosts.postType, ["daily", "coverage", "weekly"]),
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
