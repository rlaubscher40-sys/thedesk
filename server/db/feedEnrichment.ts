import { isEnrichedChannel } from "../../shared/const";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { getDb } from "./client";
import { dailyFeedItems } from "./schema";
import { feedEnrichmentJobs as jobs } from "./feedEnrichmentSchema";
import type { DailyAngles, DailyAnglesInput } from "../prompts/dailyAngles";

export const ANGLE_FIELDS = ["partnerTag", "sayThis", "whyItMatters", "counterpoint"] as const;
export const MAX_ENRICHMENT_ATTEMPTS = 3;
function database() {
  const db = getDb();
  if (!db) throw new Error("Feed enrichment database unavailable");
  return db;
}
const due = () =>
  sql`${jobs.status} IN ('pending', 'running') AND ${jobs.availableAt} <= CURRENT_TIMESTAMP`;
export type EnrichmentClaim = typeof jobs.$inferSelect & { owner: string };
const owned = (claim: EnrichmentClaim) =>
  and(
    eq(jobs.feedItemId, claim.feedItemId),
    eq(jobs.owner, claim.owner),
    eq(jobs.status, "running"),
    sql`${jobs.availableAt} > CURRENT_TIMESTAMP`
  );

/** Five-minute lease, using the database clock. Model calls have a two-minute
 * deadline. No remote work is performed inside a database transaction. */
export async function claimFeedEnrichment(): Promise<EnrichmentClaim | null> {
  const db = database();
  // Discover without locks. Locking a status/range scan takes next-key locks
  // which can deadlock against a neighbour moving its status/due-time index.
  // The primary-key read below rechecks eligibility using the database clock.
  const candidates = await db
    .select({ feedItemId: jobs.feedItemId })
    .from(jobs)
    .where(due())
    .orderBy(asc(jobs.availableAt), asc(jobs.feedItemId))
    .limit(4);
  for (const candidate of candidates) {
    const claimed = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          ...getTableColumns(jobs),
          isDue: sql<number>`${jobs.availableAt} <= CURRENT_TIMESTAMP`,
        })
        .from(jobs)
        .where(eq(jobs.feedItemId, candidate.feedItemId))
        .for("update");
      if (!current || !Number(current.isDue) || !["pending", "running"].includes(current.status))
        return null;
      const { isDue: _drop, ...job } = current;
      if (job.attempts >= MAX_ENRICHMENT_ATTEMPTS) {
        await tx
          .update(jobs)
          .set({
            status: "failed",
            reason: "attempts_exhausted",
            owner: null,
            input: null,
            finishedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(jobs.feedItemId, job.feedItemId));
        return null;
      }
      const owner = randomUUID();
      await tx
        .update(jobs)
        .set({
          status: "running",
          owner,
          attempts: job.attempts + 1,
          availableAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)`,
        })
        .where(eq(jobs.feedItemId, job.feedItemId));
      return { ...job, status: "running", owner, attempts: job.attempts + 1 };
    });
    if (claimed) return claimed;
  }
  return null;
}

export function sameEnrichmentSource(input: DailyAnglesInput, row: DailyAnglesInput) {
  return (
    input.title === row.title && input.summary === row.summary && input.category === row.category
  );
}

/** Completion and the gap-only field writes commit atomically. A late worker
 * cannot write after its lease expires or another worker takes over. */
export async function completeFeedEnrichment(
  claim: EnrichmentClaim,
  angles: DailyAngles,
  before: DailyAnglesInput & Partial<DailyAngles>
): Promise<boolean> {
  return database().transaction(async (tx) => {
    const [job] = await tx.select().from(jobs).where(owned(claim)).for("update");
    if (!job) return false;
    const [row] = await tx
      .select()
      .from(dailyFeedItems)
      .where(eq(dailyFeedItems.id, claim.feedItemId))
      .for("update");
    const changed = row && (!isEnrichedChannel(row.channel) || !sameEnrichmentSource(before, row));
    if (row && !changed) {
      const patch: Partial<DailyAngles> = {};
      for (const field of ANGLE_FIELDS) {
        // Non-null includes deliberately empty manual values. Re-read after
        // generation so an edit made while the model ran always wins.
        if (before[field] == null && row[field] == null && angles[field] != null)
          patch[field] = angles[field];
      }
      if (Object.keys(patch).length)
        await tx.update(dailyFeedItems).set(patch).where(eq(dailyFeedItems.id, row.id));
    }
    await tx
      .update(jobs)
      .set({
        status: row && !changed ? "completed" : "skipped",
        reason: !row ? "item_deleted" : changed ? "source_changed" : null,
        input: null,
        owner: null,
        finishedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(jobs.feedItemId, claim.feedItemId));
    return true;
  });
}

export async function skipFeedEnrichment(
  claim: EnrichmentClaim,
  reason: "source_changed" | "item_deleted"
) {
  await database()
    .update(jobs)
    .set({
      status: "skipped",
      reason,
      input: null,
      owner: null,
      finishedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(owned(claim));
}

export async function failFeedEnrichment(claim: EnrichmentClaim) {
  const exhausted = claim.attempts >= MAX_ENRICHMENT_ATTEMPTS;
  await database()
    .update(jobs)
    .set({
      status: exhausted ? "failed" : "pending",
      owner: null,
      reason: exhausted ? "attempts_exhausted" : "generation_or_save_failed",
      ...(exhausted ? { input: null, finishedAt: sql`CURRENT_TIMESTAMP` } : {}),
      availableAt:
        claim.attempts === 1
          ? sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE)`
          : sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)`,
    })
    .where(owned(claim));
}

export async function feedEnrichmentHealth() {
  const db = database();
  const [counts, recentFailures] = await Promise.all([
    db
      .select({ status: jobs.status, count: sql<number>`COUNT(*)` })
      .from(jobs)
      .groupBy(jobs.status),
    db
      .select({ feedItemId: jobs.feedItemId, attempts: jobs.attempts, reason: jobs.reason })
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .orderBy(desc(jobs.finishedAt))
      .limit(10),
  ]);
  return {
    counts: Object.fromEntries(counts.map((r) => [r.status, Number(r.count)])),
    recentFailures,
  };
}
