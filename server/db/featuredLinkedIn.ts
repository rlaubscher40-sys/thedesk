import { asc, desc, eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  featuredLinkedInPosts,
  type FeaturedLinkedInPost,
  type InsertFeaturedLinkedInPost,
} from "./schema";

/** Posts visible to readers — live only, in display order then newest first. */
export async function listLiveLinkedInPosts(limit = 6): Promise<FeaturedLinkedInPost[]> {
  if (isDemoMode()) return demoQueries.listLiveLinkedInPosts(limit);
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(featuredLinkedInPosts)
    .where(eq(featuredLinkedInPosts.isLive, true))
    .orderBy(asc(featuredLinkedInPosts.displayOrder), desc(featuredLinkedInPosts.createdAt))
    .limit(limit);
}

/** Admin: full list including hidden rows. */
export async function listAllLinkedInPosts(): Promise<FeaturedLinkedInPost[]> {
  if (isDemoMode()) return demoQueries.listAllLinkedInPosts();
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(featuredLinkedInPosts)
    .orderBy(asc(featuredLinkedInPosts.displayOrder), desc(featuredLinkedInPosts.createdAt));
}

export async function createLinkedInPost(
  data: InsertFeaturedLinkedInPost
): Promise<FeaturedLinkedInPost | undefined> {
  if (isDemoMode()) return demoQueries.createLinkedInPost(data);
  const db = getDb();
  if (!db) return undefined;
  await db.insert(featuredLinkedInPosts).values(data);
  const rows = await db
    .select()
    .from(featuredLinkedInPosts)
    .where(eq(featuredLinkedInPosts.postUrl, data.postUrl))
    .limit(1);
  return rows[0];
}

export async function updateLinkedInPost(
  id: number,
  patch: Partial<Omit<InsertFeaturedLinkedInPost, "id">>
): Promise<void> {
  if (isDemoMode()) return demoQueries.updateLinkedInPost(id, patch);
  const db = getDb();
  if (!db) return;
  await db.update(featuredLinkedInPosts).set(patch).where(eq(featuredLinkedInPosts.id, id));
}

export async function deleteLinkedInPost(id: number): Promise<void> {
  if (isDemoMode()) return demoQueries.deleteLinkedInPost(id);
  const db = getDb();
  if (!db) return;
  await db.delete(featuredLinkedInPosts).where(eq(featuredLinkedInPosts.id, id));
}
