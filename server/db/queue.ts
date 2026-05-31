import { and, between, desc, eq, isNotNull, isNull } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { dailyFeedItems, readingQueue, users, type InsertReadingQueueItem } from "./schema";

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

export type NudgeCandidate = {
  queueId: number;
  userId: number;
  userEmail: string | null;
  feedItemId: number;
  feedTitle: string;
  feedCategory: string;
  sayThis: string;
  savedAt: Date;
};

/** Queue items linked to a talking point saved 2-4 days ago that haven't
 *  been nudged yet. Skips items where the user has no email address. */
export async function findQueueItemsNeedingNudge(): Promise<NudgeCandidate[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
  const fourDaysAgo = new Date(now.getTime() - 4 * 86_400_000);
  const rows = await db
    .select({
      queueId: readingQueue.id,
      userId: readingQueue.userId,
      userEmail: users.email,
      feedItemId: dailyFeedItems.id,
      feedTitle: dailyFeedItems.title,
      feedCategory: dailyFeedItems.category,
      sayThis: dailyFeedItems.sayThis,
      savedAt: readingQueue.createdAt,
    })
    .from(readingQueue)
    .innerJoin(dailyFeedItems, eq(readingQueue.feedItemId, dailyFeedItems.id))
    .innerJoin(users, eq(readingQueue.userId, users.id))
    .where(
      and(
        isNull(readingQueue.nudgeSentAt),
        isNotNull(dailyFeedItems.sayThis),
        between(readingQueue.createdAt, fourDaysAgo, twoDaysAgo)
      )
    );
  return rows
    .filter((r): r is NudgeCandidate & { sayThis: string } => Boolean(r.sayThis && r.userEmail))
    .map((r) => ({ ...r, sayThis: r.sayThis! }));
}

export async function markNudgeSent(id: number): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  await db.update(readingQueue).set({ nudgeSentAt: new Date() }).where(eq(readingQueue.id, id));
}

export async function recordNudgeResponse(id: number, response: string): Promise<void> {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) return;
  await db.update(readingQueue).set({ nudgeResponse: response }).where(eq(readingQueue.id, id));
}
