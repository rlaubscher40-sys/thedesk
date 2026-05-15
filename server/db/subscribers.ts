import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import {
  subscribers,
  type InsertSubscriber,
  type Subscriber,
} from "./schema";

export async function findSubscriberByEmail(
  email: string
): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.findSubscriberByEmail(email);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1);
  return rows[0];
}

export async function findSubscriberByToken(
  token: string
): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.findSubscriberByToken(token);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.confirmToken, token))
    .limit(1);
  return rows[0];
}

/**
 * Insert a new subscriber, or — if the email already exists — return the
 * existing row so the caller can decide whether to re-send a confirm
 * email or treat the call as a no-op.
 */
export async function createSubscriber(data: InsertSubscriber): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.createSubscriber(data);
  const db = getDb();
  if (!db) return undefined;
  // MySQL has no clean upsert-returning, so look up + insert.
  const existing = await findSubscriberByEmail(data.email);
  if (existing) return existing;
  await db.insert(subscribers).values(data);
  return findSubscriberByEmail(data.email);
}

export async function confirmSubscriber(token: string): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.confirmSubscriber(token);
  const db = getDb();
  if (!db) return undefined;
  const row = await findSubscriberByToken(token);
  if (!row) return undefined;
  await db
    .update(subscribers)
    .set({ confirmedAt: new Date(), confirmToken: null })
    .where(eq(subscribers.id, row.id));
  return findSubscriberByEmail(row.email);
}

export async function unsubscribeByEmail(email: string): Promise<void> {
  if (isDemoMode()) return demoQueries.unsubscribeByEmail(email);
  const db = getDb();
  if (!db) return;
  await db
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(subscribers.email, email));
}

export async function listSubscribers(): Promise<Subscriber[]> {
  if (isDemoMode()) return demoQueries.listSubscribers();
  const db = getDb();
  if (!db) return [];
  return db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
}

export async function countConfirmedSubscribers(): Promise<number> {
  if (isDemoMode()) return demoQueries.countConfirmedSubscribers();
  const db = getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(and(isNotNull(subscribers.confirmedAt), isNull(subscribers.unsubscribedAt)));
  return rows.length;
}
