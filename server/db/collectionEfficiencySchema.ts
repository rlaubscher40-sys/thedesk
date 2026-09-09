import { bigint, int, mysqlTable, primaryKey, timestamp, varchar } from "drizzle-orm/mysql-core";

export const feedIngestClaims = mysqlTable("feed_ingest_claims", {
  identity: varchar("identity", { length: 64 }).primaryKey(),
  feedItemId: int("feedItemId"),
  acceptedAt: timestamp("acceptedAt"),
});

export const localTransferStats = mysqlTable(
  "local_transfer_stats",
  {
    sourceKey: varchar("sourceKey", { length: 48 }).notNull(),
    day: varchar("day", { length: 10 }).notNull(),
    downloads: int("downloads").notNull().default(0),
    unchanged: int("unchanged").notNull().default(0),
    bodyBytes: bigint("bodyBytes", { mode: "number" }).notNull().default(0),
    estimatedAvoidedBytes: bigint("estimatedAvoidedBytes", { mode: "number" }).notNull().default(0),
    unknownSize: int("unknownSize").notNull().default(0),
    firstMeasuredAt: timestamp("firstMeasuredAt").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sourceKey, table.day] })]
);

export const COLLECTION_EFFICIENCY_DDL = [
  {
    name: "collection efficiency · feed claims",
    sql: `CREATE TABLE feed_ingest_claims (
    identity VARCHAR(64) PRIMARY KEY, feedItemId INT NULL, acceptedAt TIMESTAMP NULL
  )`,
  },
  {
    name: "collection efficiency · local transfers",
    sql: `CREATE TABLE local_transfer_stats (
    sourceKey VARCHAR(48) NOT NULL, day VARCHAR(10) NOT NULL,
    downloads INT NOT NULL DEFAULT 0, unchanged INT NOT NULL DEFAULT 0,
    bodyBytes BIGINT NOT NULL DEFAULT 0, estimatedAvoidedBytes BIGINT NOT NULL DEFAULT 0,
    unknownSize INT NOT NULL DEFAULT 0, firstMeasuredAt TIMESTAMP NOT NULL,
    PRIMARY KEY (sourceKey, day)
  )`,
  },
];
