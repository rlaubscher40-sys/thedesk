import { index, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const propertyEvidence = mysqlTable(
  "property_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    identity: varchar("identity", { length: 64 }).notNull().unique(),
    title: varchar("title", { length: 480 }).notNull(),
    summary: text("summary").notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    publishedAt: timestamp("publishedAt").notNull(),
    regions: json("regions").$type<string[]>().notNull(),
    topics: json("topics").$type<string[]>().notNull(),
    firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  (table) => [index("idx_property_evidence_published").on(table.publishedAt)]
);

export const evidenceSourceStatus = mysqlTable("evidence_source_status", {
  sourceId: varchar("sourceId", { length: 160 }).primaryKey(),
  checkedAt: timestamp("checkedAt").notNull(),
  lastSuccessAt: timestamp("lastSuccessAt"),
  newestPublishedAt: timestamp("newestPublishedAt"),
  fetched: int("fetched").notNull(),
  accepted: int("accepted").notNull(),
  error: varchar("error", { length: 240 }),
});
export type PropertyEvidence = typeof propertyEvidence.$inferSelect;
