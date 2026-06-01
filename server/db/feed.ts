import { and, desc, eq, gte, isNotNull, like, or, sql } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { dailyFeedItems, editions, type DailyFeedItem, type InsertDailyFeedItem } from "./schema";

/** Most recent 30 items if no date specified, otherwise everything for that day. */
/**
 * Today (Sydney) in YYYY-MM-DD. Used as the default feedDate filter so
 * the Today page actually shows today's items rather than the latest N
 * items irrespective of date.
 */
function sydneyToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export async function listFeedItems(date?: string): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listFeedItems(date);
  const db = getDb();
  if (!db) return [];
  if (date) {
    return db
      .select()
      .from(dailyFeedItems)
      .where(eq(dailyFeedItems.feedDate, date))
      .orderBy(desc(dailyFeedItems.priority), desc(dailyFeedItems.createdAt));
  }
  // No date supplied: try today (Sydney) first; if today has nothing yet
  // (the morning ingest hasn't run), fall back to the most recent date
  // that does have items so the Today page is never empty when the
  // archive isn't.
  const today = sydneyToday();
  const todayRows = await db
    .select()
    .from(dailyFeedItems)
    .where(eq(dailyFeedItems.feedDate, today))
    .orderBy(desc(dailyFeedItems.createdAt));
  if (todayRows.length > 0) return todayRows;
  const recentDate = await db
    .selectDistinct({ feedDate: dailyFeedItems.feedDate })
    .from(dailyFeedItems)
    .orderBy(desc(dailyFeedItems.feedDate))
    .limit(1);
  const fallback = recentDate[0]?.feedDate;
  if (!fallback) return [];
  return db
    .select()
    .from(dailyFeedItems)
    .where(eq(dailyFeedItems.feedDate, fallback))
    .orderBy(desc(dailyFeedItems.createdAt));
}

export async function getFeedItemById(id: number): Promise<DailyFeedItem | undefined> {
  if (isDemoMode()) return demoQueries.getFeedItemById(id);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(dailyFeedItems).where(eq(dailyFeedItems.id, id)).limit(1);
  return rows[0];
}

/**
 * Batch fetch by ids. Order is NOT preserved, caller should resort
 * if it cares. Used by the anonymous reading queue to hydrate
 * localStorage bookmarks in a single request.
 */
export async function getFeedItemsByIds(ids: number[]): Promise<DailyFeedItem[]> {
  if (ids.length === 0) return [];
  if (isDemoMode()) return demoQueries.getFeedItemsByIds?.(ids) ?? [];
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyFeedItems)
    .where(sql`${dailyFeedItems.id} IN (${sql.join(ids, sql`, `)})`);
}

/**
 * Paginated archive query, feed items across all dates, optionally
 * filtered by category. Used by the /archive page.
 */
export async function listArchive(opts: {
  category?: string;
  limit: number;
  offset: number;
}): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listArchive(opts);
  const db = getDb();
  if (!db) return [];
  const base = db.select().from(dailyFeedItems);
  const filtered = opts.category
    ? base.where(eq(dailyFeedItems.category, opts.category.toUpperCase()))
    : base;
  return filtered
    .orderBy(desc(dailyFeedItems.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
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

/**
 * Returns all sourceUrls that appeared in the feed within the last
 * `windowDays` calendar days. Used at ingest time to reject re-runs of the
 * same story that was already published recently.
 */
export async function getRecentSourceUrls(windowDays: number): Promise<Set<string>> {
  if (isDemoMode()) return new Set();
  const db = getDb();
  if (!db) return new Set();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const rows = await db
    .select({ sourceUrl: dailyFeedItems.sourceUrl })
    .from(dailyFeedItems)
    .where(and(isNotNull(dailyFeedItems.sourceUrl), gte(dailyFeedItems.feedDate, cutoffStr)));
  return new Set(rows.map((r) => r.sourceUrl!));
}

/**
 * Bulk-insert feed items and return their new IDs in the same order as the
 * input array. mysql2 reports the first auto-increment id; a single
 * multi-row INSERT assigns consecutive ids, so the rest are derived by
 * offset. Callers zip these against the input rows to enrich each item
 * without re-matching by title (titles can collide across sources).
 */
export async function createFeedItems(items: InsertDailyFeedItem[]): Promise<number[]> {
  if (isDemoMode()) return demoQueries.createFeedItems(items);
  const db = getDb();
  if (!db) throw new Error("createFeedItems: database unavailable");
  if (items.length === 0) return [];
  const result = await db.insert(dailyFeedItems).values(items);
  const firstId = Number(
    (result as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0
  );
  if (!firstId) return [];
  return items.map((_, i) => firstId + i);
}

export async function deleteFeedItem(id: number): Promise<void> {
  if (isDemoMode()) return demoQueries.deleteFeedItem(id);
  const db = getDb();
  if (!db) return;
  await db.delete(dailyFeedItems).where(eq(dailyFeedItems.id, id));
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

export async function updateFeedItemWhyItMatters(id: number, whyItMatters: string) {
  if (isDemoMode()) return demoQueries.updateFeedItemWhyItMatters(id, whyItMatters);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ whyItMatters }).where(eq(dailyFeedItems.id, id));
}

export async function updateFeedItemCounterpoint(id: number, counterpoint: string) {
  if (isDemoMode()) return demoQueries.updateFeedItemCounterpoint?.(id, counterpoint);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ counterpoint }).where(eq(dailyFeedItems.id, id));
}

export async function updateFeedItemRubensNote(id: number, rubensNote: string | null) {
  if (isDemoMode()) return demoQueries.updateFeedItemRubensNote(id, rubensNote);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ rubensNote }).where(eq(dailyFeedItems.id, id));
}

export async function updateFeedItemPriority(id: number, priority: number) {
  if (isDemoMode()) return demoQueries.updateFeedItemPriority?.(id, priority);
  const db = getDb();
  if (!db) return;
  await db.update(dailyFeedItems).set({ priority }).where(eq(dailyFeedItems.id, id));
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

/** Items missing a sayThis line, used by the backfill admin procedure. */
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

/** Items missing a whyItMatters line, used by the backfill admin procedure.
 *  Stories ingested before the column existed all have it null, so this
 *  drives a one-off catch-up over recent feed history. */
export async function listFeedItemsMissingWhyItMatters(limit = 50): Promise<DailyFeedItem[]> {
  if (isDemoMode()) return demoQueries.listFeedItemsMissingWhyItMatters(limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(dailyFeedItems)
    .orderBy(desc(dailyFeedItems.createdAt))
    .limit(500);
  return rows
    .filter((r) => !r.whyItMatters || r.whyItMatters.trim().length === 0)
    .slice(0, limit);
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
