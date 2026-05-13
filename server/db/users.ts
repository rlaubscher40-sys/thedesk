import { eq } from "drizzle-orm";
import { env } from "../core/env";
import { getDb } from "./client";
import { type InsertUser, type User, users } from "./schema";

/**
 * Upsert a user record from the OAuth flow. Tolerates a missing database
 * (returns silently) so the auth middleware can keep behaving sensibly during
 * local dev without MySQL running.
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("upsertUser: openId required");
  const db = getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

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
  } else if (user.openId === env.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}
