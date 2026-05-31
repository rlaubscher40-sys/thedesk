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
 * Insert a new subscriber, or, if the email already exists, return the
 * existing row so the caller can decide whether to re-send a confirm
 * email or treat the call as a no-op.
 */
export async function createSubscriber(data: InsertSubscriber): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.createSubscriber(data);
  const db = getDb();
  if (!db) return undefined;
  // MySQL has no clean upsert-returning, so look up + insert. If a row
  // already exists for this email we refresh its confirmToken instead
  // of returning a stale row — the caller (subscribe mutation) generated
  // a fresh token for the email it just sent, and persisting that token
  // is the whole point of this call. Without the update the email links
  // resolve to nothing and confirm fails with "invalid or expired".
  // Confirmed rows are left untouched: a re-subscribe by a confirmed
  // address is a no-op the router handles earlier.
  const existing = await findSubscriberByEmail(data.email);
  if (existing) {
    // Leave confirmed+active rows alone; the router handles them.
    if (existing.confirmedAt && !existing.unsubscribedAt) return existing;
    if (data.confirmToken) {
      // Refresh the token and also clear unsubscribedAt so a re-subscriber
      // who had previously unsubscribed is treated as a fresh subscription
      // once they confirm again.
      await db
        .update(subscribers)
        .set({ confirmToken: data.confirmToken, unsubscribedAt: null })
        .where(eq(subscribers.id, existing.id));
    }
    return findSubscriberByEmail(data.email);
  }
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
    .set({ confirmedAt: new Date(), confirmToken: null, unsubscribedAt: null })
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

export async function listConfirmedSubscribers(): Promise<Subscriber[]> {
  if (isDemoMode()) {
    const all = await demoQueries.listSubscribers();
    return all.filter((s) => s.confirmedAt && !s.unsubscribedAt);
  }
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscribers)
    .where(and(isNotNull(subscribers.confirmedAt), isNull(subscribers.unsubscribedAt)));
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
