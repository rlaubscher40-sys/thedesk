/**
 * Self-hosted readership + product-engagement analytics.
 *
 * Page views and a tiny allow-list of product events share the existing
 * `page_views` table so this remains migration-free. Engagement rows use the
 * reserved `@event/` path namespace and are excluded from every page-view
 * aggregate. Both record only an ephemeral session id; no IP or persistent
 * identity is stored.
 */
import { and, desc, gte, like, notLike, sql } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { pageViews, type InsertPageView, type PageView } from "./schema";

const EVENT_PREFIX = "@event/";
const EVENT_PATTERN = `${EVENT_PREFIX}%`;

export async function recordPageView(data: InsertPageView): Promise<void> {
  if (isDemoMode()) return demoQueries.recordPageView(data);
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(pageViews).values(data);
  } catch (err) {
    console.warn(`[analytics] couldn't persist page view: ${(err as Error).message}`);
  }
}

export async function recordEngagementEvent(data: {
  event: string;
  surface?: string | null;
  sessionId: string;
}): Promise<void> {
  const surface = (data.surface ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 32);
  const path = `${EVENT_PREFIX}${data.event}${surface ? `/${surface}` : ""}`.slice(0, 256);
  await recordPageView({ path, referrer: null, sessionId: data.sessionId });
}

export async function listRecentPageViews(limit = 50): Promise<PageView[]> {
  if (isDemoMode()) return demoQueries.listRecentPageViews(limit);
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(pageViews)
    .where(notLike(pageViews.path, EVENT_PATTERN))
    .orderBy(desc(pageViews.viewedAt))
    .limit(limit);
}

/** Headline counts over a rolling window. Engagement events are excluded. */
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
    .where(and(gte(pageViews.viewedAt, since), notLike(pageViews.path, EVENT_PATTERN)));
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
    .where(and(gte(pageViews.viewedAt, since), notLike(pageViews.path, EVENT_PATTERN)))
    .groupBy(pageViews.path)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ path: r.path, views: Number(r.views) }));
}

/** Top referrer hostnames, excluding product-event rows. */
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
    .where(and(gte(pageViews.viewedAt, since), notLike(pageViews.path, EVENT_PATTERN)))
    .groupBy(pageViews.referrer)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows
    .filter((r) => r.referrer)
    .map((r) => ({ referrer: r.referrer ?? "", views: Number(r.views) }));
}

/** Per-day view counts across a window, excluding product events. */
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
    .where(and(gte(pageViews.viewedAt, since), notLike(pageViews.path, EVENT_PATTERN)))
    .groupBy(sql`date(viewedAt)`)
    .orderBy(sql`date(viewedAt) desc`);
  return rows.map((r) => ({ day: String(r.day), views: Number(r.views) }));
}

/**
 * Product actions over a rolling window. Exact paths are safe to expose to the
 * admin because both the event and optional surface are server allow-listed;
 * no question text, market name or metric value is persisted here.
 */
export async function engagementSummary(
  windowHours: number,
  limit = 20
): Promise<Array<{ event: string; surface: string | null; count: number; sessions: number }>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      path: pageViews.path,
      count: sql<number>`count(*)`,
      sessions: sql<number>`count(distinct sessionId)`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, since), like(pageViews.path, EVENT_PATTERN)))
    .groupBy(pageViews.path)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((row) => {
    const [event = "unknown", surface] = row.path.slice(EVENT_PREFIX.length).split("/", 2);
    return {
      event,
      surface: surface || null,
      count: Number(row.count),
      sessions: Number(row.sessions),
    };
  });
}
