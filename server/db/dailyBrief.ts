import { randomUUID } from "node:crypto";
import { and, desc, eq, getTableColumns, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { dailyFeedItems, subscribers } from "./schema";
import { feedEnrichmentJobs } from "./feedEnrichmentSchema";
import {
  dailyBriefBatches as batches,
  dailyBriefDeliveries as deliveries,
  type BriefStories,
} from "./dailyBriefSchema";
import type { SendInput } from "../core/mailer";
function database() {
  const db = getDb();
  if (!db) throw new Error("Daily brief database unavailable");
  return db;
}
const key = (date: string, id: number) =>
  and(eq(deliveries.feedDate, date), eq(deliveries.subscriberId, id));
export type BriefClaim = typeof deliveries.$inferSelect & { owner: string; payload: SendInput };
const owned = (claim: BriefClaim) =>
  and(
    key(claim.feedDate, claim.subscriberId),
    eq(deliveries.owner, claim.owner),
    eq(deliveries.status, "running"),
    sql`${deliveries.availableAt} > CURRENT_TIMESTAMP`
  );
export const dailyBriefIdempotencyKey = (date: string, id: number) =>
  `daily-brief/v1/${date}/${id}`;

export async function readBriefBatch(date: string): Promise<BriefStories | null> {
  const [row] = await database().select().from(batches).where(eq(batches.feedDate, date));
  return row?.items ?? null;
}
/** Read story text and its completion marker from one database snapshot, so a
 * completion between two reads cannot put pre-enrichment text in the email. */
export async function readReadyBriefStories(date: string): Promise<BriefStories | null> {
  const rows = await database()
    .select({
      id: dailyFeedItems.id,
      title: dailyFeedItems.title,
      category: dailyFeedItems.category,
      summary: dailyFeedItems.summary,
      whyItMatters: dailyFeedItems.whyItMatters,
      status: feedEnrichmentJobs.status,
    })
    .from(dailyFeedItems)
    .leftJoin(feedEnrichmentJobs, eq(feedEnrichmentJobs.feedItemId, dailyFeedItems.id))
    .where(
      and(eq(dailyFeedItems.feedDate, date), sql`${dailyFeedItems.channel} IN ('AU','PROPERTY')`)
    )
    .orderBy(desc(dailyFeedItems.priority), desc(dailyFeedItems.createdAt), desc(dailyFeedItems.id))
    .limit(5);
  if (!rows.length || rows.some((row) => row.status !== "completed")) return null;
  return rows.map(({ status: _drop, ...item }) => item);
}
export async function freezeBriefBatch(date: string, items: BriefStories): Promise<BriefStories> {
  await database()
    .insert(batches)
    .values({ feedDate: date, items })
    .onDuplicateKeyUpdate({ set: { feedDate: sql`${batches.feedDate}` } });
  const stored = await readBriefBatch(date);
  if (!stored) throw new Error("Daily brief snapshot missing");
  return stored;
}
export async function dailyBriefCandidates(date: string) {
  return database()
    .select({ id: subscribers.id, email: subscribers.email, name: subscribers.name })
    .from(subscribers)
    .leftJoin(
      deliveries,
      and(eq(deliveries.feedDate, date), eq(deliveries.subscriberId, subscribers.id))
    )
    .where(
      and(
        isNotNull(subscribers.confirmedAt),
        isNull(subscribers.unsubscribedAt),
        or(isNull(subscribers.lastDailyBriefDate), lt(subscribers.lastDailyBriefDate, date)),
        or(
          isNull(deliveries.subscriberId),
          sql`${deliveries.status} IN ('pending','running') AND ${deliveries.availableAt} <= CURRENT_TIMESTAMP`
        )
      )
    )
    .orderBy(subscribers.id)
    .limit(50);
}

/** Snapshot + claim is committed before the provider is contacted. Reclaiming
 * always uses the stored payload, even after edits or a template deployment. */
export async function claimDailyBrief(
  date: string,
  id: number,
  payload: SendInput
): Promise<BriefClaim | null> {
  return database().transaction(async (tx) => {
    await tx
      .insert(deliveries)
      .values({ feedDate: date, subscriberId: id, payload })
      .onDuplicateKeyUpdate({ set: { subscriberId: sql`${deliveries.subscriberId}` } });
    const [row] = await tx
      .select({
        ...getTableColumns(deliveries),
        due: sql<number>`${deliveries.availableAt} <= CURRENT_TIMESTAMP`,
      })
      .from(deliveries)
      .where(key(date, id))
      .for("update");
    if (!row || !Number(row.due) || !["pending", "running"].includes(row.status)) return null;
    if (row.attempts >= 3 || !row.payload) {
      await tx
        .update(deliveries)
        .set({ status: "failed", payload: null, owner: null })
        .where(key(date, id));
      return null;
    }
    const owner = randomUUID();
    await tx
      .update(deliveries)
      .set({
        status: "running",
        attempts: row.attempts + 1,
        owner,
        availableAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 MINUTE)`,
      })
      .where(key(date, id));
    return { ...row, payload: row.payload, owner, status: "running", attempts: row.attempts + 1 };
  });
}
export async function briefRecipientEligible(claim: BriefClaim) {
  const [row] = await database()
    .select({ email: subscribers.email })
    .from(deliveries)
    .innerJoin(subscribers, eq(subscribers.id, deliveries.subscriberId))
    .where(
      and(
        owned(claim),
        isNotNull(subscribers.confirmedAt),
        isNull(subscribers.unsubscribedAt),
        or(
          isNull(subscribers.lastDailyBriefDate),
          lt(subscribers.lastDailyBriefDate, claim.feedDate)
        )
      )
    );
  return row?.email === claim.payload.to;
}
export async function finishDailyBrief(
  claim: BriefClaim,
  result: "accepted" | "retry" | "skipped",
  receipt?: string
) {
  return database().transaction(async (tx) => {
    const [row] = await tx.select().from(deliveries).where(owned(claim)).for("update");
    if (!row) return false;
    const status = result === "retry" ? (claim.attempts >= 3 ? "failed" : "pending") : result;
    await tx
      .update(deliveries)
      .set({
        status,
        owner: null,
        ...(status === "pending" ? {} : { payload: null }),
        receipt: receipt ?? null,
        availableAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)`,
      })
      .where(key(claim.feedDate, claim.subscriberId));
    if (result === "accepted") {
      if (!receipt) throw new Error("Provider receipt required");
      await tx
        .update(subscribers)
        .set({ lastDailyBriefDate: claim.feedDate })
        .where(
          and(
            eq(subscribers.id, claim.subscriberId),
            or(
              isNull(subscribers.lastDailyBriefDate),
              lt(subscribers.lastDailyBriefDate, claim.feedDate)
            )
          )
        );
    }
    return true;
  });
}
export async function expireDailyBriefs(today: string, windowClosed = false) {
  await database()
    .update(deliveries)
    .set({ status: "expired", owner: null, payload: null })
    .where(
      and(
        windowClosed ? sql`${deliveries.feedDate} <= ${today}` : lt(deliveries.feedDate, today),
        sql`${deliveries.status} IN ('pending','running')`
      )
    );
}
export async function dailyBriefHealth(date: string) {
  const counts = await database()
    .select({ status: deliveries.status, count: sql<number>`COUNT(*)` })
    .from(deliveries)
    .where(eq(deliveries.feedDate, date))
    .groupBy(deliveries.status);
  const recentIssues = await database()
    .select({
      feedDate: deliveries.feedDate,
      subscriberId: deliveries.subscriberId,
      status: deliveries.status,
    })
    .from(deliveries)
    .where(sql`${deliveries.status} IN ('failed','expired')`)
    .orderBy(sql`${deliveries.feedDate} DESC`, deliveries.subscriberId)
    .limit(10);
  return {
    date,
    recentIssues,
    prepared: Boolean(await readBriefBatch(date)),
    counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])),
  };
}
