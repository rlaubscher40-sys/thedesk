/**
 * Page-view queries.
 *
 * Replaces the Plausible script with a self-hosted equivalent. All
 * writes go through `recordPageView` and the admin panels read
 * aggregated views from `summary` / `topPaths` / `topReferrers`. Demo
 * mode keeps a 500-entry ring buffer; production persists to MySQL.
 */
import { desc, gte, sql } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  pageViews,
  type InsertPageView,
  type PageView,
} from "./schema";

export async function recordPageView(data: InsertPageView): Promise<void> {
  if (isDemoMode()) return demoQueries.recordPageView(data);
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(pageViews).values(data);
  } catch (err) {
    console.warn(
      `[analytics] couldn't persist page view: ${(err as Error).message}`
    );
  }
}

export async function listRecentPageViews(limit = 50): Promise<PageView[]> {
  if (isDemoMode()) return demoQueries.listRecentPageViews(limit);
  const db = getDb();
  if (!db) return [];
  return db.select().from(pageViews).orderBy(desc(pageViews.viewedAt)).limit(limit);
}

/** Headline counts over a rolling window. */
export async function pageViewSummary(
  windowHours: number
): Promise<{ views: number; sessions: number }> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.pageViewSummary(since);
  const db = getDb();
  if (!db) return { views: 0, sessions: 0 };
  const rows = await db
    .select({
      views: sql<number>`count(*)`,
      sessions: sql<number>`count(distinct sessionId)`,
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since));
  const r = rows[0];
  return { views: Number(r?.views ?? 0), sessions: Number(r?.sessions ?? 0) };
}

/** Top paths over a rolling window, sorted by view count. */
export async function topPaths(
  windowHours: number,
  limit = 10
): Promise<Array<{ path: string; views: number }>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.topPaths(since, limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      path: pageViews.path,
      views: sql<number>`count(*)`,
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since))
    .groupBy(pageViews.path)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ path: r.path, views: Number(r.views) }));
}

/** Top referrer hostnames. */
export async function topReferrers(
  windowHours: number,
  limit = 10
): Promise<Array<{ referrer: string; views: number }>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.topReferrers(since, limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      referrer: pageViews.referrer,
      views: sql<number>`count(*)`,
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since))
    .groupBy(pageViews.referrer)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows
    .filter((r) => r.referrer)
    .map((r) => ({ referrer: r.referrer ?? "", views: Number(r.views) }));
}

/** Per-day view counts across a window (for the sparkline). Returns
 *  rows newest-first; caller reverses for left-to-right rendering. */
export async function pageViewsByDay(
  windowDays: number
): Promise<Array<{ day: string; views: number }>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.pageViewsByDay(since);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      day: sql<string>`date(viewedAt)`,
      views: sql<number>`count(*)`,
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since))
    .groupBy(sql`date(viewedAt)`)
    .orderBy(sql`date(viewedAt) desc`);
  return rows.map((r) => ({ day: String(r.day), views: Number(r.views) }));
}
