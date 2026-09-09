import { index, int, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { DailyAnglesInput } from "../prompts/dailyAngles";

export const feedEnrichmentJobs = mysqlTable(
  "feed_enrichment_jobs",
  {
    feedItemId: int("feedItemId").primaryKey(),
    input: json("input").$type<DailyAnglesInput>(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    owner: varchar("owner", { length: 36 }),
    availableAt: timestamp("availableAt").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    finishedAt: timestamp("finishedAt"),
    reason: varchar("reason", { length: 32 }),
  },
  (t) => [index("feed_enrichment_due").on(t.status, t.availableAt)]
);

export const FEED_ENRICHMENT_DDL = [
  {
    name: "feed enrichment · durable jobs",
    sql: `CREATE TABLE feed_enrichment_jobs (
    feedItemId INT PRIMARY KEY, input JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
    owner VARCHAR(36) NULL, availableAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt TIMESTAMP NULL,
    reason VARCHAR(32) NULL, INDEX feed_enrichment_due (status, availableAt)
  )`,
  },
];
