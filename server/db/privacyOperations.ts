import { sql } from "drizzle-orm";
import { CONFIRM_TOKEN_TTL_MS } from "../../shared/const";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";

/** Read-only case preparation. Never exposes confirmation tokens, signed links,
 * frozen email bodies or credentials. Identity verification precedes disclosure. */
export async function privacyRequestInventory(email: string) {
  if (isDemoMode()) return { demoMode: true, subscriber: null, counts: {}, consentEvents: [] };
  const db = getDb();
  if (!db) throw new Error("Privacy database unavailable");
  const [rows] = await db.execute(sql`SELECT id, email, name, source, createdAt, confirmedAt,
    unsubscribedAt, consentNoticeVersion, consentRequestedAt FROM subscribers WHERE email=${email} LIMIT 1`);
  const subscriber =
    (rows as unknown as Array<{ id: number; email: string; name: string | null }>)[0] ?? null;
  const [feedback] = await db.execute(
    sql`SELECT COUNT(*) AS count FROM feedback_submissions WHERE contactEmail=${email}`
  );
  const count = (value: unknown) => Number((value as Array<{ count: number }>)[0]?.count ?? 0);
  const [users] = await db.execute(sql`SELECT COUNT(*) AS count FROM users WHERE email=${email}`);
  let deliveries = 0;
  let consentEvents: Array<{
    event: string;
    noticeVersion: string | null;
    source: string | null;
    requestedAt: Date | null;
    createdAt: Date;
  }> = [];
  if (subscriber) {
    const [deliveryRows] = await db.execute(
      sql`SELECT COUNT(*) AS count FROM daily_brief_deliveries WHERE subscriberId=${subscriber.id}`
    );
    deliveries = count(deliveryRows);
    const [events] =
      await db.execute(sql`SELECT event, noticeVersion, source, requestedAt, createdAt
      FROM subscriber_consent_events WHERE subscriberId=${subscriber.id} ORDER BY id DESC LIMIT 100`);
    consentEvents = events as unknown as typeof consentEvents;
  }
  return {
    demoMode: false,
    subscriber,
    counts: { feedback: count(feedback), accounts: count(users), deliveries },
    consentEvents,
  };
}

/** Minimise data already unusable for its original task. Bounded batches,
 * no subscriber deletion, no removal of opt-out records or consent evidence. */
export async function cleanExpiredPrivatePayloads() {
  if (isDemoMode()) return;
  const db = getDb();
  if (!db) throw new Error("Privacy cleanup database unavailable");
  const cutoff = new Date(Date.now() - CONFIRM_TOKEN_TTL_MS);
  await db.execute(sql`UPDATE subscribers SET confirmToken=NULL, confirmTokenSentAt=NULL
    WHERE confirmTokenSentAt < ${cutoff} AND confirmToken IS NOT NULL LIMIT 1000`);
  await db.execute(sql`UPDATE daily_brief_deliveries SET payload=NULL
    WHERE status IN ('accepted','skipped','failed','expired') AND payload IS NOT NULL LIMIT 1000`);
  await db.execute(sql`UPDATE feed_enrichment_jobs SET input=NULL, status='skipped', reason='legal_review_expired', finishedAt=CURRENT_TIMESTAMP
    WHERE status='legal-held' AND createdAt < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY) LIMIT 1000`);
}
