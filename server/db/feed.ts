import { desc, eq, like, or, sql } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { dailyFeedItems, editions, type DailyFeedItem, type InsertDailyFeedItem } from "./schema";

/** Most recent 30 items if no date specified, otherwise everything for that day. */
export async function listFeedItems(date?: string): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listFeedItems(date);
  const db = getDb();
  if (!db) return [];
  if (date) {
    return db
      .select()
      .from(dailyFeedItems)
      .where(eq(dailyFeedItems.feedDate, date))
      .orderBy(desc(dailyFeedItems.createdAt));
  }
  return db.select().from(dailyFeedItems).orderBy(desc(dailyFeedItems.createdAt)).limit(30);
}

export async function getFeedItemById(id: number): Promise<DailyFeedItem | undefined> {
  if (isDemoMode()) return demoQueries.getFeedItemById(id);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(dailyFeedItems).where(eq(dailyFeedItems.id, id)).limit(1);
  return rows[0];
}

export async function getRecentFeedDates(limit = 14): Promise<string[]> {
  if (isDemoMode()) return demoQueries.getRecentFeedDates(limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ feedDate: dailyFeedItems.feedDate })
    .from(dailyFeedItems)
    .orderBy(desc(dailyFeedItems.feedDate))
    .limit(limit);
  return rows.map((r) => r.feedDate);
}

export async function createFeedItems(items: InsertDailyFeedItem[]) {
  if (isDemoMode()) return demoQueries.createFeedItems(items);
  const db = getDb();
  if (!db) throw new Error("createFeedItems: database unavailable");
  if (items.length === 0) return;
  return db.insert(dailyFeedItems).values(items);
}

export async function updateFeedItemPartnerTag(id: number, partnerTag: string) {
  if (isDemoMode()) return demoQueries.updateFeedItemPartnerTag(id, partnerTag);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ partnerTag }).where(eq(dailyFeedItems.id, id));
}

export async function updateFeedItemSayThis(id: number, sayThis: string) {
  if (isDemoMode()) return demoQueries.updateFeedItemSayThis(id, sayThis);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ sayThis }).where(eq(dailyFeedItems.id, id));
}

export async function updateFeedItemImageUrl(id: number, imageUrl: string) {
  if (isDemoMode()) return demoQueries.updateFeedItemImageUrl(id, imageUrl);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ imageUrl }).where(eq(dailyFeedItems.id, id));
}

/** Items between two YYYY-MM-DD dates inclusive. Used by the weekly
 *  synthesis pipeline to gather a week of stories. */
export async function listFeedItemsBetween(
  startDate: string,
  endDate: string
): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listFeedItemsBetween(startDate, endDate);
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyFeedItems)
    .where(
      sql`${dailyFeedItems.feedDate} >= ${startDate} AND ${dailyFeedItems.feedDate} <= ${endDate}`
    )
    .orderBy(desc(dailyFeedItems.createdAt));
}

/** Items missing a sayThis line — used by the backfill admin procedure. */
export async function listFeedItemsMissingSayThis(limit = 50): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listFeedItemsMissingSayThis(limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(dailyFeedItems)
    .orderBy(desc(dailyFeedItems.createdAt))
    .limit(500);
  return rows.filter((r) => !r.sayThis || r.sayThis.trim().length === 0).slice(0, limit);
}

export async function getFeedItemsByCategory(category: string, limit = 100): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.getFeedItemsByCategory(category, limit);
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyFeedItems)
    .where(eq(dailyFeedItems.category, category.toUpperCase()))
    .orderBy(desc(dailyFeedItems.createdAt))
    .limit(limit);
}

/** Returns the de-duplicated set of category strings used across feed + editions. */
export async function listAllCategories(): Promise<string[]> {
  if (isDemoMode()) return demoQueries.listAllCategories();
  const db = getDb();
  if (!db) return [];
  const feedRows = await db.selectDistinct({ category: dailyFeedItems.category }).from(dailyFeedItems);
  const set = new Set<string>();
  for (const row of feedRows) {
    if (row.category) set.add(row.category.toUpperCase());
  }
  const editionRows = await db.select({ topics: editions.topics }).from(editions);
  for (const row of editionRows) {
    const topics = row.topics ?? [];
    for (const t of topics) {
      if (t?.category) set.add(String(t.category).toUpperCase());
    }
  }
  return Array.from(set).sort();
}

export async function getCategoryHeat(days: number) {
  if (isDemoMode()) return demoQueries.getCategoryHeat(days);
  const db = getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const feedRows = await db
    .select({ category: dailyFeedItems.category })
    .from(dailyFeedItems)
    .where(sql`${dailyFeedItems.feedDate} >= ${cutoffStr}`);

  const editionRows = await db
    .select({ topics: editions.topics })
    .from(editions)
    .where(sql`${editions.publishedAt} >= ${cutoff}`);

  const counts: Record<string, { daily: number; weekly: number; total: number }> = {};
  for (const row of feedRows) {
    const cat = (row.category || "OTHER").toUpperCase();
    counts[cat] ??= { daily: 0, weekly: 0, total: 0 };
    counts[cat].daily++;
    counts[cat].total++;
  }
  for (const row of editionRows) {
    for (const t of row.topics ?? []) {
      const cat = (t.category || "OTHER").toUpperCase();
      counts[cat] ??= { daily: 0, weekly: 0, total: 0 };
      counts[cat].weekly++;
      counts[cat].total++;
    }
  }
  return Object.entries(counts)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);
}

export async function searchAllContent(query: string) {
  if (isDemoMode()) return demoQueries.searchAllContent(query);
  const db = getDb();
  if (!db) return { editions: [], feedItems: [] };
  const pattern = `%${query}%`;
  const editionResults = await db
    .select()
    .from(editions)
    .where(or(like(editions.fullText, pattern), like(editions.weekOf, pattern)))
    .orderBy(desc(editions.editionNumber));
  const feedResults = await db
    .select()
    .from(dailyFeedItems)
    .where(or(like(dailyFeedItems.title, pattern), like(dailyFeedItems.summary, pattern)))
    .orderBy(desc(dailyFeedItems.createdAt))
    .limit(50);
  return { editions: editionResults, feedItems: feedResults };
}
