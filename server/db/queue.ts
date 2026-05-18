import { and, desc, eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { dailyFeedItems, readingQueue, type InsertReadingQueueItem } from "./schema";

export type EnrichedQueueItem = Awaited<ReturnType<typeof getEnrichedQueue>>[number];

export async function getEnrichedQueue(userId: number) {
  if (isDemoMode()) return demoQueries.getEnrichedQueue(userId);
  const db = getDb();
  if (!db) return [];
  // Left-join to feed items in a single round-trip, the reference code did N+1.
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
  if (isDemoMode()) return demoQueries.addToQueue(item);
  const db = getDb();
  if (!db) throw new Error("addToQueue: database unavailable");
  return db.insert(readingQueue).values(item);
}

export async function markQueueItemRead(id: number, userId: number) {
  if (isDemoMode()) return demoQueries.markQueueItemRead(id, userId);
  const db = getDb();
  if (!db) return;
  return db
    .update(readingQueue)
    .set({ isRead: true })
    .where(and(eq(readingQueue.id, id), eq(readingQueue.userId, userId)));
}

export async function removeFromQueue(id: number, userId: number) {
  if (isDemoMode()) return demoQueries.removeFromQueue(id, userId);
  const db = getDb();
  if (!db) return;
  return db.delete(readingQueue).where(and(eq(readingQueue.id, id), eq(readingQueue.userId, userId)));
}

export async function clearQueue(userId: number) {
  if (isDemoMode()) return demoQueries.clearQueue(userId);
  const db = getDb();
  if (!db) return;
  return db.delete(readingQueue).where(eq(readingQueue.userId, userId));
}

export async function markAllQueueRead(userId: number) {
  if (isDemoMode()) return demoQueries.markAllQueueRead(userId);
  const db = getDb();
  if (!db) return;
  return db.update(readingQueue).set({ isRead: true }).where(eq(readingQueue.userId, userId));
}
