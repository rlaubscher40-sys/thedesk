import { desc, gte, lte, and, sql, lt, eq } from "drizzle-orm";
import { json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { getDb } from "./client";
import { propertyEvidence } from "./evidenceSchema";
import { dailyFeedItems } from "./schema";
import {
  legacyEditorialHold,
  localEditorialChannel,
  type EditorialReport,
} from "../../shared/editorial";
import type { FetchedItem } from "../../scripts/ingest/lib/rss";
import type { EvidenceStory } from "../../shared/storyEvidenceDuplicate";
import { feedEvidenceFingerprints } from "./feedEvidenceSchema";
import { relatedCoverageParent, type RelatedStory } from "../../shared/relatedCoverage";
import { staleFutureDeadline } from "../../shared/editorialTiming";

/** Authenticated ingest context only: private hashes, never article text.
 * Bounded recent, visible rows; held rows cannot block news. */
export async function recentEditorialStories(): Promise<EvidenceStory[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      id: dailyFeedItems.id,
      title: dailyFeedItems.title,
      channel: dailyFeedItems.channel,
      evidenceFingerprint: feedEvidenceFingerprints.fingerprint,
      sourceTiming: dailyFeedItems.sourceTiming,
    })
    .from(dailyFeedItems)
    .innerJoin(feedEvidenceFingerprints, eq(feedEvidenceFingerprints.feedItemId, dailyFeedItems.id))
    .where(
      and(
        gte(
          dailyFeedItems.feedDate,
          new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10)
        ),
        sql`${dailyFeedItems.channel} IN ('AU','PROPERTY')`
      )
    )
    .orderBy(desc(dailyFeedItems.priority), dailyFeedItems.id)
    .limit(500);
}

export const editorialRuns = mysqlTable("editorial_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  report: json("report").$type<EditorialReport>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const EDITORIAL_DDL = [
  {
    name: "editorial · run reports",
    sql: "CREATE TABLE editorial_runs (id VARCHAR(36) PRIMARY KEY, report JSON NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_editorial_created (createdAt))",
  },
];
export async function recordEditorialReport(report: EditorialReport) {
  const db = getDb();
  if (!db) throw new Error("Editorial reporting database unavailable");
  await db
    .insert(editorialRuns)
    .values({ id: report.runId, report })
    .onDuplicateKeyUpdate({ set: { report } });
  await db
    .delete(editorialRuns)
    .where(lt(editorialRuns.createdAt, new Date(Date.now() - 30 * 86_400_000)));
  await db
    .delete(feedEvidenceFingerprints)
    .where(lt(feedEvidenceFingerprints.createdAt, new Date(Date.now() - 14 * 86400000)));
}
export async function editorialHealth() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(editorialRuns).orderBy(desc(editorialRuns.createdAt)).limit(10);
}
/** The hourly evidence collector supplies candidates, not pre-approved stories. */
export async function recentEditorialCandidates(): Promise<FetchedItem[]> {
  const db = getDb();
  if (!db) return [];
  const now = new Date();
  const rows = await db
    .select()
    .from(propertyEvidence)
    .where(
      and(
        gte(propertyEvidence.publishedAt, new Date(now.getTime() - 96 * 3_600_000)),
        lte(propertyEvidence.publishedAt, now)
      )
    )
    .orderBy(desc(propertyEvidence.publishedAt))
    .limit(250);
  return rows.map((r) => ({
    title: r.title,
    summary: r.summary,
    source: r.source,
    url: r.sourceUrl,
    category: "PROPERTY",
    channel: "PROPERTY",
    isoDate: r.publishedAt.toISOString(),
    imageUrl: null,
    discovery: "evidence-pool",
  }));
}

/** Quarantine obvious reference material without deleting IDs, bookmarks or links.
 * The private HOLD lane is never offered in public tabs or email selection. */
export async function repairEditorialReferences(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(dailyFeedItems)
    .where(
      and(
        gte(
          dailyFeedItems.feedDate,
          new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
        ),
        sql`${dailyFeedItems.channel} IN ('AU','PROPERTY')`
      )
    );
  let held = 0;
  for (const row of rows) {
    const reason = legacyEditorialHold(row);
    if (reason) {
      await db
        .update(dailyFeedItems)
        .set({ channel: "HOLD", priority: 0 })
        .where(eq(dailyFeedItems.id, row.id));
      held++;
    } else {
      const channel = localEditorialChannel(row);
      if (channel !== row.channel)
        await db.update(dailyFeedItems).set({ channel }).where(eq(dailyFeedItems.id, row.id));
    }
  }
  return held;
}

/** Link actual publications, including neighbours inserted in the same run.
 * Does not suppress reporting or turn related coverage into corroboration. */
export async function linkPublishedCoverage(items: Array<RelatedStory & { id: number; threadParentId?: number | null }>, startIndex = 0) {
  const db = getDb();
  if (!db) return 0;
  let linked = 0;
  for (let i = startIndex; i < items.length; i++) {
    const item = items[i]!;
    if (item.threadParentId) continue;
    const parent = relatedCoverageParent(item, items.slice(0, i));
    if (!parent) continue;
    const [result] = await db.update(dailyFeedItems).set({ threadParentId: parent.id, threadParentTitle: parent.title })
      .where(and(eq(dailyFeedItems.id, item.id), sql`${dailyFeedItems.threadParentId} IS NULL`));
    linked += result.affectedRows;
  }
  return linked;
}

/** Bounded startup repair. Compare old values before changing them; keep all
 * story IDs and leave Ruben's notes intact. No model or publisher requests. */
export async function repairCoverageAudit(now = new Date()) {
  const db = getDb();
  if (!db) return;
  const rows = await db.select({
    id: dailyFeedItems.id, title: dailyFeedItems.title, summary: dailyFeedItems.summary,
    channel: dailyFeedItems.channel, feedDate: dailyFeedItems.feedDate, sourceUrl: dailyFeedItems.sourceUrl,
    sourceTiming: dailyFeedItems.sourceTiming, threadParentId: dailyFeedItems.threadParentId,
    partnerTag: dailyFeedItems.partnerTag, sayThis: dailyFeedItems.sayThis,
    whyItMatters: dailyFeedItems.whyItMatters, counterpoint: dailyFeedItems.counterpoint,
  }).from(dailyFeedItems).where(and(
    gte(dailyFeedItems.feedDate, new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 10)),
    sql`${dailyFeedItems.channel} IN ('AU','PROPERTY')`
  )).orderBy(dailyFeedItems.createdAt, dailyFeedItems.id).limit(500);
  let corrected = 0;
  for (const row of rows) {
    for (const field of ["partnerTag", "sayThis", "whyItMatters", "counterpoint"] as const) {
      if (row[field] && staleFutureDeadline(row[field], now)) {
        await db.update(dailyFeedItems).set({ [field]: null })
          .where(and(eq(dailyFeedItems.id, row.id), eq(dailyFeedItems[field], row[field]!)));
        corrected++;
      }
    }
  }
  const linked = await linkPublishedCoverage(rows);
  // Source-verified September 11 follow-up has a generic title/summary. Its
  // original release explicitly cites the same 10,700-home model. Do not use
  // generated angles to guess this relationship or generalise these URLs.
  const parent = rows.find(r => r.sourceUrl === "https://masterbuilders.com.au/joint-statement-updated-modelling-housing-package-estimated-to-cut-10700-homes-and-push-rents-higher/" && r.feedDate === "2026-09-11");
  const followup = rows.find(r => r.sourceUrl === "https://masterbuilders.com.au/housing-supply-sliding-backwards-worsening-crisis/" && r.feedDate === "2026-09-11");
  if (parent && followup && parent.id !== followup.id)
    await db.update(dailyFeedItems).set({ threadParentId: parent.id, threadParentTitle: parent.title })
      .where(and(eq(dailyFeedItems.id, followup.id), sql`${dailyFeedItems.threadParentId} IS NULL`));
  console.log(`[coverage-repair] cleared ${corrected} expired angles; linked ${linked} related publications`);
}
