/**
 * Page-view queries.
 *
 * Replaces the Plausible script with a self-hosted equivalent. All
 * writes go through `recordPageView` and the admin panels read
 * aggregated views from `summary` / `topPaths` / `topReferrers` /
 * `topCountries` / `countrySplit`. Demo mode keeps a 500-entry ring
 * buffer; production persists to MySQL.
 */
import { and, desc, gte, isNotNull, sql } from "drizzle-orm";
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

/** Top countries over a rolling window, sorted by view count.
 *
 *  Rows with no country (pre-migration backfill, or a request that
 *  reached the origin without CF-IPCountry) are excluded in SQL rather
 *  than after the fact: MySQL groups all NULLs into one bucket, and
 *  immediately after the migration that bucket is the biggest one — it
 *  would consume a slot in the LIMIT and quietly return nine countries
 *  instead of ten. `countrySplit` reports the unknowns separately so
 *  they stay visible instead of vanishing. */
export async function topCountries(
  windowHours: number,
  limit = 10
): Promise<Array<{ country: string; views: number }>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.topCountries(since, limit);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      country: pageViews.country,
      views: sql<number>`count(*)`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, since), isNotNull(pageViews.country)))
    .groupBy(pageViews.country)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ country: r.country ?? "", views: Number(r.views) }));
}

/** Australia vs everyone else over a rolling window.
 *
 *  Deliberately a separate full-table aggregate rather than something
 *  derived from `topCountries` — a top-10 list truncates the tail, so
 *  computing a percentage from it would overstate the AU share. This
 *  is the number the whole column exists for, so it gets counted
 *  exactly. Views and sessions both, since one Aussie reading ten
 *  pages is not ten Aussies. */
export async function countrySplit(
  windowHours: number
): Promise<{
  au: number;
  other: number;
  unknown: number;
  auSessions: number;
  totalSessions: number;
}> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.countrySplit(since);
  const db = getDb();
  if (!db) {
    return { au: 0, other: 0, unknown: 0, auSessions: 0, totalSessions: 0 };
  }
  const rows = await db
    .select({
      au: sql<number>`sum(case when country = 'AU' then 1 else 0 end)`,
      other: sql<number>`sum(case when country is not null and country <> 'AU' then 1 else 0 end)`,
      unknown: sql<number>`sum(case when country is null then 1 else 0 end)`,
      auSessions: sql<number>`count(distinct case when country = 'AU' then sessionId end)`,
      totalSessions: sql<number>`count(distinct sessionId)`,
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since));
  const r = rows[0];
  return {
    au: Number(r?.au ?? 0),
    other: Number(r?.other ?? 0),
    unknown: Number(r?.unknown ?? 0),
    auSessions: Number(r?.auSessions ?? 0),
    totalSessions: Number(r?.totalSessions ?? 0),
  };
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
