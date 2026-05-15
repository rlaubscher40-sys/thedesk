import { eq } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { type InsertUser, type User, users } from "./schema";

/**
 * Upsert the admin user row. There's only ever one user (Ruben) so this is
 * always called with `openId: "admin"` — but the function stays generic so
 * the schema doesn't need to change.
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("upsertUser: openId required");
  if (isDemoMode()) return demoQueries.upsertUser();
  const db = getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, role: "admin" };
  const updateSet: Record<string, unknown> = { role: "admin" };

  for (const field of ["name", "email", "loginMethod"] as const) {
    const value = user[field];
    if (value === undefined) continue;
    const normalised = value ?? null;
    values[field] = normalised;
    updateSet[field] = normalised;
  }

  const signedInAt = user.lastSignedIn ?? new Date();
  values.lastSignedIn = signedInAt;
  updateSet.lastSignedIn = signedInAt;

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  if (isDemoMode()) return demoQueries.getUserByOpenId(openId);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}
