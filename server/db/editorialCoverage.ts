import { and, desc, eq, gte, lte } from "drizzle-orm";
import { int, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";
import { getDb } from "./client";
import { dailyFeedItems } from "./schema";
import { editorialRuns } from "./editorial";
import { coverageExamples } from "../../shared/editorialCoverageExamples";
import { coverageSocialEvidence } from "./coverageSocial";
import { articleIdentity } from "../../scripts/ingest/lib/dedupe";
import {
  coverageStartDay,
  evaluateCoverage,
  type CoverageEntry,
  type CoverageSave,
} from "../../shared/editorialCoverage";

export const editorialCoverageDays = mysqlTable("editorial_coverage_days", {
  day: varchar("day", { length: 10 }).primaryKey(),
  version: int("version").notNull(),
  entries: json("entries").$type<CoverageEntry[]>().notNull(),
  updatedBy: int("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export const COVERAGE_DDL = [
  {
    name: "editorial · daily coverage review",
    sql: "CREATE TABLE editorial_coverage_days (day VARCHAR(10) PRIMARY KEY, version INT NOT NULL, entries JSON NOT NULL, updatedBy INT NOT NULL, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  },
];
function requiredDb() {
  const db = getDb();
  if (!db) throw new Error("Coverage review database unavailable");
  return db;
}
export async function saveCoverage(input: CoverageSave, userId: number, db = requiredDb()) {
  const values = {
    day: input.day,
    version: input.version + 1,
    entries: input.entries,
    updatedBy: userId,
    updatedAt: new Date(),
  };
  const result =
    input.version === 0
      ? await db.insert(editorialCoverageDays).ignore().values(values)
      : await db
          .update(editorialCoverageDays)
          .set(values)
          .where(
            and(
              eq(editorialCoverageDays.day, input.day),
              eq(editorialCoverageDays.version, input.version)
            )
          );
  if (result[0].affectedRows !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This day's review changed in another tab. Reload before saving.",
    });
  return { version: values.version };
}
export async function readCoverage(day: string, db = requiredDb(), now = new Date()) {
  const start = coverageStartDay(day);
  const lower = new Date(Date.parse(`${start}T00:00:00Z`) - 14 * 3600000);
  const upper = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000);
  const [saved, publications, runs, days] = await Promise.all([
    db.select().from(editorialCoverageDays).where(eq(editorialCoverageDays.day, day)),
    db
      .select({
        id: dailyFeedItems.id,
        title: dailyFeedItems.title,
        sourceUrl: dailyFeedItems.sourceUrl,
        channel: dailyFeedItems.channel,
        feedDate: dailyFeedItems.feedDate,
        createdAt: dailyFeedItems.createdAt,
      })
      .from(dailyFeedItems)
      .where(and(gte(dailyFeedItems.feedDate, start), lte(dailyFeedItems.feedDate, day)))
      .orderBy(desc(dailyFeedItems.createdAt))
      .limit(5001),
    db
      .select()
      .from(editorialRuns)
      .where(and(gte(editorialRuns.createdAt, lower), lte(editorialRuns.createdAt, upper)))
      .orderBy(desc(editorialRuns.createdAt))
      .limit(201),
    db
      .select({ day: editorialCoverageDays.day, version: editorialCoverageDays.version })
      .from(editorialCoverageDays)
      .orderBy(desc(editorialCoverageDays.day))
      .limit(31),
  ]);
  const row = saved[0];
  const entries = row?.entries ?? coverageExamples(day);
  const expectedUrls = new Set(
    entries.flatMap((e) => e.urls.map((url) => articleIdentity({ url, title: "" })))
  );
  const social = await coverageSocialEvidence(
    publications
      .slice(0, 5000)
      .filter(
        (p) => p.sourceUrl && expectedUrls.has(articleIdentity({ url: p.sourceUrl, title: "" }))
      ),
    db
  );
  return {
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
    days,
    evidenceLimited: publications.length > 5000 || runs.length > 200,
    ...evaluateCoverage(
      entries,
      day,
      publications.slice(0, 5000),
      runs.slice(0, 200).map((r) => r.report),
      now,
      social
    ),
  };
}
