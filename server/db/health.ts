/**
 * Health queries — server errors and uptime pings.
 *
 * Demo mode keeps both as in-memory ring buffers capped at 200 entries
 * each, so a long-running demo doesn't grow unbounded. Production
 * persists to MySQL.
 */
import { and, desc, gte, lte, sql } from "drizzle-orm";
import { monitoringCoverage } from "../../shared/monitoringCoverage";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  serverErrors,
  uptimePings,
  type InsertServerError,
  type InsertUptimePing,
  type ServerError,
  type UptimePing,
} from "./schema";

export async function recordServerError(data: InsertServerError): Promise<void> {
  // Tracking URLs and browser agents can exceed the database varchar limits.
  data = {
    ...data,
    message: data.message.slice(0, 512),
    level: data.level?.slice(0, 16),
    method: data.method?.slice(0, 16),
    route: data.route?.split(/[?#]/, 1)[0]?.slice(0, 256),
    userAgent: data.userAgent?.slice(0, 256),
  };
  if (isDemoMode()) return demoQueries.recordServerError(data);
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(serverErrors).values(data);
  } catch (err) {
    // Don't let error-logging fail loudly inside the error handler
    // path. Console.warn so the operator sees it without re-throwing.
    console.warn(`[health] couldn't persist server error: ${(err as Error).message}`);
  }
}

export async function listRecentServerErrors(limit = 50): Promise<ServerError[]> {
  if (isDemoMode()) return demoQueries.listRecentServerErrors(limit);
  const db = getDb();
  if (!db) return [];
  return db.select().from(serverErrors).orderBy(desc(serverErrors.occurredAt)).limit(limit);
}

export async function countServerErrorsSince(since: Date): Promise<number> {
  if (isDemoMode()) return demoQueries.countServerErrorsSince(since);
  const db = getDb();
  if (!db) return 0;
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(serverErrors)
    .where(gte(serverErrors.occurredAt, since));
  return Number(rows[0]?.n ?? 0);
}

export async function clearServerErrors(): Promise<void> {
  if (isDemoMode()) return demoQueries.clearServerErrors();
  const db = getDb();
  if (!db) return;
  await db.delete(serverErrors);
}

export async function recordUptimePing(data: InsertUptimePing): Promise<void> {
  if (isDemoMode()) return demoQueries.recordUptimePing(data);
  const db = getDb();
  if (!db) return;
  await db.insert(uptimePings).values(data);
}

export async function listRecentUptimePings(limit = 288): Promise<UptimePing[]> {
  if (isDemoMode()) return demoQueries.listRecentUptimePings(limit);
  const db = getDb();
  if (!db) return [];
  return db.select().from(uptimePings).orderBy(desc(uptimePings.pingedAt)).limit(limit);
}

/** At most 289 groups, regardless of retries or number of probe sources. */
export async function uptimeMonitoringCoverage(now = new Date()) {
  if (isDemoMode())
    return monitoringCoverage(
      demoQueries.listRecentUptimePings(10000).map((p) => p.pingedAt),
      now
    );
  const db = getDb();
  if (!db) throw new Error("Monitoring coverage unavailable");
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // Both edges preserve long gaps; a raw row limit would truncate the window
  // when retries cluster, so aggregate across the entire interval in SQL.
  const rows = await db
    .select({
      first: sql<Date>`min(${uptimePings.pingedAt})`,
      last: sql<Date>`max(${uptimePings.pingedAt})`,
    })
    .from(uptimePings)
    .where(and(gte(uptimePings.pingedAt, since), lte(uptimePings.pingedAt, now)))
    .groupBy(sql`floor(timestampdiff(microsecond, ${since}, ${uptimePings.pingedAt}) / 300000000)`);
  return monitoringCoverage(
    rows.flatMap((row) => [row.first, row.last]),
    now
  );
}

/** Aggregate successful sampled requests, not wall-clock uptime. */
export async function uptimeWindowStats(
  windowHours = 24
): Promise<{ total: number; up: number; avgLatencyMs: number }> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  if (isDemoMode()) return demoQueries.uptimeWindowStats(since);
  const db = getDb();
  if (!db) return { total: 0, up: 0, avgLatencyMs: 0 };
  const rows = await db
    .select({
      total: sql<number>`count(*)`,
      up: sql<number>`sum(case when statusCode >= 200 and statusCode < 300 then 1 else 0 end)`,
      avgLatencyMs: sql<number>`coalesce(avg(latencyMs), 0)`,
    })
    .from(uptimePings)
    .where(gte(uptimePings.pingedAt, since));
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    up: Number(r?.up ?? 0),
    avgLatencyMs: Math.round(Number(r?.avgLatencyMs ?? 0)),
  };
}
