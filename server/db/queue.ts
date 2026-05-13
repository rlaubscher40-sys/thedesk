import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { dailyFeedItems, readingQueue, type InsertReadingQueueItem } from "./schema";

export type EnrichedQueueItem = Awaited<ReturnType<typeof getEnrichedQueue>>[number];

export async function getEnrichedQueue(userId: number) {
  const db = getDb();
  if (!db) return [];
  // Left-join to feed items in a single round-trip — the reference code did N+1.
  const rows = await db
    .select({
      queue: readingQueue,
      feed: dailyFeedItems,
    })
    .from(readingQueue)
    .leftJoin(dailyFeedItems, eq(readingQueue.feedItemId, dailyFeedItems.id))
    .where(eq(readingQueue.userId, userId))
    .orderBy(desc(readingQueue.createdAt));

  return rows.map(({ queue, feed }) => ({
    ...queue,
    feedTitle: feed?.title ?? null,
    feedSummary: feed?.summary ?? null,
    feedCategory: feed?.category ?? null,
    feedSource: feed?.source ?? null,
    feedSourceUrl: feed?.sourceUrl ?? null,
    feedDate: feed?.feedDate ?? null,
  }));
}

export async function addToQueue(item: InsertReadingQueueItem) {
  const db = getDb();
  if (!db) throw new Error("addToQueue: database unavailable");
  return db.insert(readingQueue).values(item);
}

export async function markQueueItemRead(id: number, userId: number) {
  const db = getDb();
  if (!db) return;
  return db
    .update(readingQueue)
    .set({ isRead: true })
    .where(and(eq(readingQueue.id, id), eq(readingQueue.userId, userId)));
}

export async function removeFromQueue(id: number, userId: number) {
  const db = getDb();
  if (!db) return;
  return db.delete(readingQueue).where(and(eq(readingQueue.id, id), eq(readingQueue.userId, userId)));
}

export async function clearQueue(userId: number) {
  const db = getDb();
  if (!db) return;
  return db.delete(readingQueue).where(eq(readingQueue.userId, userId));
}

export async function markAllQueueRead(userId: number) {
  const db = getDb();
  if (!db) return;
  return db.update(readingQueue).set({ isRead: true }).where(eq(readingQueue.userId, userId));
}
