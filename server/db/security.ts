/** Durable security state. No production fallback when the database is unavailable. */
import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";

export const SECURITY_DDL = [
  {
    name: "security · limits",
    sql: `CREATE TABLE security_limits (bucketKey VARCHAR(191) PRIMARY KEY, used INT NOT NULL DEFAULT 0, expiresMs BIGINT NOT NULL, INDEX idx_security_limits_expiry (expiresMs))`,
  },
  {
    name: "security · sessions",
    sql: `CREATE TABLE admin_sessions (sessionId VARCHAR(64) PRIMARY KEY, expiresMs BIGINT NOT NULL, INDEX idx_admin_sessions_expiry (expiresMs))`,
  },
];
export type Budget = { key: string; limit: number; expiresMs: number; cost?: number };
const demoLimits = new Map<string, { used: number; expiresMs: number }>();
const demoSessions = new Map<string, number>();
class Exhausted extends Error {}
function database() {
  const db = getDb();
  if (!db) throw new Error("Security database unavailable");
  return db;
}

/** Verify required columns without retrieving any security-state rows. */
export async function assertSecuritySchemaReady(): Promise<void> {
  if (isDemoMode()) return;
  try {
    await database().execute(sql`SELECT bucketKey, used, expiresMs FROM security_limits LIMIT 0`);
    await database().execute(sql`SELECT sessionId, expiresMs FROM admin_sessions LIMIT 0`);
  } catch {
    // Do not leak database connection details in the deployment error.
    throw new Error("Security schema unavailable; verify security_limits and admin_sessions migrations and permissions");
  }
}

/** All limits reserve together, or none do. Sorted row locks prevent lock-order deadlocks. */
export async function chargeBudgets(budgets: Budget[]): Promise<boolean> {
  const ordered = [...budgets].sort((a, b) => a.key.localeCompare(b.key));
  if (new Set(ordered.map((b) => b.key)).size !== ordered.length)
    throw new Error("Duplicate budget key");
  const now = Date.now();
  if (isDemoMode()) {
    for (const [key, value] of demoLimits) if (value.expiresMs <= now) demoLimits.delete(key);
    if (demoLimits.size + ordered.length > 10000) return false;
    if (ordered.some((b) => (demoLimits.get(b.key)?.used ?? 0) + (b.cost ?? 1) > b.limit))
      return false;
    for (const b of ordered)
      demoLimits.set(b.key, {
        used: (demoLimits.get(b.key)?.used ?? 0) + (b.cost ?? 1),
        expiresMs: b.expiresMs,
      });
    return true;
  }
  try {
    await database().transaction(async (tx) => {
      for (const b of ordered) {
        await tx.execute(
          // The no-op duplicate update acquires an exclusive lock immediately.
          // INSERT IGNORE would take shared duplicate-key locks that can deadlock
          // when concurrent reservations both upgrade to SELECT FOR UPDATE.
          sql`INSERT INTO security_limits (bucketKey, used, expiresMs) VALUES (${b.key}, 0, ${b.expiresMs}) ON DUPLICATE KEY UPDATE bucketKey = bucketKey`
        );
        const [result] = await tx.execute(
          sql`SELECT used, expiresMs FROM security_limits WHERE bucketKey = ${b.key} FOR UPDATE`
        );
        const row = (result as unknown as Array<{ used: number; expiresMs: number }>)[0];
        if (!row) throw new Error("Security budget row unavailable");
        const used = Number(row.expiresMs) <= now ? 0 : Number(row.used);
        if (used + (b.cost ?? 1) > b.limit) throw new Exhausted();
        await tx.execute(
          sql`UPDATE security_limits SET used = ${used + (b.cost ?? 1)}, expiresMs = ${b.expiresMs} WHERE bucketKey = ${b.key}`
        );
      }
    });
    return true;
  } catch (error) {
    if (error instanceof Exhausted) return false;
    throw error;
  }
}
export async function refundBudget(key: string): Promise<void> {
  if (isDemoMode()) {
    const b = demoLimits.get(key);
    if (b) b.used = Math.max(0, b.used - 1);
    return;
  }
  await database().execute(
    sql`UPDATE security_limits SET used = GREATEST(0, used - 1) WHERE bucketKey = ${key}`
  );
}
export async function budgetUsed(key: string): Promise<number> {
  if (isDemoMode()) return demoLimits.get(key)?.used ?? 0;
  const [rows] = await database().execute(
    sql`SELECT used FROM security_limits WHERE bucketKey = ${key}`
  );
  return Number((rows as unknown as Array<{ used: number }>)[0]?.used ?? 0);
}
export async function saveAdminSession(id: string, expiresMs: number) {
  if (isDemoMode()) {
    demoSessions.set(id, expiresMs);
    return;
  }
  await database().execute(
    sql`INSERT INTO admin_sessions (sessionId, expiresMs) VALUES (${id}, ${expiresMs})`
  );
}
export async function hasAdminSession(id: string) {
  if (isDemoMode()) return (demoSessions.get(id) ?? 0) > Date.now();
  const [rows] = await database().execute(
    sql`SELECT sessionId FROM admin_sessions WHERE sessionId=${id} AND expiresMs>${Date.now()}`
  );
  return (rows as unknown as unknown[]).length === 1;
}
export async function deleteAdminSession(id: string) {
  if (isDemoMode()) {
    demoSessions.delete(id);
    return;
  }
  await database().execute(sql`DELETE FROM admin_sessions WHERE sessionId=${id}`);
}
export async function cleanSecurityState() {
  if (isDemoMode()) return;
  await database().execute(
    sql`DELETE FROM security_limits WHERE expiresMs < ${Date.now() - 86400000} LIMIT 1000`
  );
  await database().execute(
    sql`DELETE FROM admin_sessions WHERE expiresMs < ${Date.now()} LIMIT 1000`
  );
}
export function resetDemoSecurityState() {
  demoLimits.clear();
  demoSessions.clear();
}
