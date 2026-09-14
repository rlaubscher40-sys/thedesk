import { subscriberConsentEvents } from "./consentSchema";
import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { CONFIRM_TOKEN_TTL_MS } from "../../shared/const";
import * as demoQueries from "../demo/queries";
import { isDemoMode } from "../demo/store";
import { getDb } from "./client";
import { subscribers, type InsertSubscriber, type Subscriber } from "./schema";

/** Outcome of a confirm attempt, so the caller can message the reader precisely. */
export type ConfirmResult =
  | { status: "confirmed"; subscriber: Subscriber }
  | { status: "not-found" }
  | { status: "expired" };

export async function findSubscriberByEmail(email: string): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.findSubscriberByEmail(email);
  const db = getDb();
  if (!db) return undefined;
  const rows = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);
  return rows[0];
}

/** Row locks serialize confirmation, unsubscribe and a fresh request. Consent
 * events commit with the state change, so a failed audit write rolls it back. */
export async function createSubscriber(data: InsertSubscriber): Promise<Subscriber | undefined> {
  if (isDemoMode()) return demoQueries.createSubscriber(data);
  const db = getDb();
  if (!db) throw new Error("Subscription database unavailable");
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(subscribers)
      .values({ ...data, confirmedAt: null, confirmTokenSentAt: now, consentRequestedAt: now })
      .onDuplicateKeyUpdate({ set: { id: sql`${subscribers.id}` } });
    const [row] = await tx
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, data.email))
      .for("update");
    if (!row) throw new Error("Subscriber row unavailable");
    if (row.confirmedAt && !row.unsubscribedAt) return row;
    if (!data.confirmToken) return row;
    const patch = {
      confirmToken: data.confirmToken,
      confirmTokenSentAt: now,
      confirmedAt: null,
      consentNoticeVersion: data.consentNoticeVersion ?? null,
      consentRequestedAt: now,
      source: data.source ?? null,
    };
    await tx.update(subscribers).set(patch).where(eq(subscribers.id, row.id));
    await tx
      .insert(subscriberConsentEvents)
      .values({
        subscriberId: row.id,
        event: "requested",
        noticeVersion: patch.consentNoticeVersion,
        source: patch.source,
        requestedAt: now,
      });
    return { ...row, ...patch };
  });
}

export async function confirmSubscriber(token: string): Promise<ConfirmResult> {
  if (isDemoMode()) {
    const sub = await demoQueries.confirmSubscriber(token);
    return sub ? { status: "confirmed", subscriber: sub } : { status: "not-found" };
  }
  const db = getDb();
  if (!db) throw new Error("Subscription database unavailable");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(subscribers)
      .where(eq(subscribers.confirmToken, token))
      .for("update");
    if (!row) return { status: "not-found" as const };
    if (
      row.confirmTokenSentAt &&
      Date.now() - new Date(row.confirmTokenSentAt).getTime() > CONFIRM_TOKEN_TTL_MS
    )
      return { status: "expired" as const };
    const patch = {
      confirmedAt: new Date(),
      confirmToken: null,
      confirmTokenSentAt: null,
      unsubscribedAt: null,
    };
    await tx.update(subscribers).set(patch).where(eq(subscribers.id, row.id));
    await tx
      .insert(subscriberConsentEvents)
      .values({
        subscriberId: row.id,
        event: "confirmed",
        noticeVersion: row.consentNoticeVersion,
        source: row.source,
        requestedAt: row.consentRequestedAt,
      });
    return { status: "confirmed" as const, subscriber: { ...row, ...patch } };
  });
}

export async function unsubscribeByEmail(email: string): Promise<void> {
  if (isDemoMode()) return demoQueries.unsubscribeByEmail(email);
  const db = getDb();
  if (!db) throw new Error("Subscription database unavailable");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email))
      .for("update");
    if (!row || (row.unsubscribedAt && !row.confirmToken)) return;
    await tx
      .update(subscribers)
      .set({ unsubscribedAt: new Date(), confirmToken: null, confirmTokenSentAt: null })
      .where(eq(subscribers.id, row.id));
    await tx
      .insert(subscriberConsentEvents)
      .values({
        subscriberId: row.id,
        event: "unsubscribed",
        noticeVersion: row.consentNoticeVersion,
        source: row.source,
        requestedAt: row.consentRequestedAt,
      });
  });
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

/** Mark these subscriber IDs as having received today's daily brief. */
export async function markDailyBriefSent(ids: number[], date: string): Promise<void> {
  if (isDemoMode() || ids.length === 0) return;
  const db = getDb();
  if (!db) return;
  await db
    .update(subscribers)
    .set({ lastDailyBriefDate: date })
    .where(inArray(subscribers.id, ids));
}

/** Confirmed subscribers who haven't received this week's recap yet.
 *  `weekOf` is the Monday ISO date of the target week (YYYY-MM-DD). */
export async function listSubscribersForWeeklyRecap(weekOf: string): Promise<Subscriber[]> {
  if (isDemoMode()) return [];
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscribers)
    .where(
      and(
        isNotNull(subscribers.confirmedAt),
        isNull(subscribers.unsubscribedAt),
        or(isNull(subscribers.lastWeeklyRecapDate), ne(subscribers.lastWeeklyRecapDate, weekOf))
      )
    );
}

/** Mark these subscriber IDs as having received the weekly recap for `weekOf`. */
export async function markWeeklyRecapSent(ids: number[], weekOf: string): Promise<void> {
  if (isDemoMode() || ids.length === 0) return;
  const db = getDb();
  if (!db) return;
  await db
    .update(subscribers)
    .set({ lastWeeklyRecapDate: weekOf })
    .where(inArray(subscribers.id, ids));
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
