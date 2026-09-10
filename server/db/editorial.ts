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
