import { int, json, mysqlTable, primaryKey, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { SendInput, buildDailyBriefEmail } from "../core/mailer";
export type BriefStories = Parameters<typeof buildDailyBriefEmail>[0]["items"];
export const dailyBriefBatches = mysqlTable("daily_brief_batches", {
  feedDate: varchar("feedDate", { length: 10 }).primaryKey(),
  items: json("items").$type<BriefStories>().notNull(),
});
export const dailyBriefDeliveries = mysqlTable(
  "daily_brief_deliveries",
  {
    feedDate: varchar("feedDate", { length: 10 }).notNull(),
    subscriberId: int("subscriberId").notNull(),
    payload: json("payload").$type<SendInput>(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    owner: varchar("owner", { length: 36 }),
    availableAt: timestamp("availableAt").notNull().defaultNow(),
    receipt: varchar("receipt", { length: 256 }),
  },
  (t) => [primaryKey({ columns: [t.feedDate, t.subscriberId] })]
);
export const DAILY_BRIEF_DDL = [
  {
    name: "daily brief · frozen stories",
    sql: `CREATE TABLE daily_brief_batches (
    feedDate VARCHAR(10) PRIMARY KEY, items JSON NOT NULL
  )`,
  },
  {
    name: "daily brief · delivery recovery",
    sql: `CREATE TABLE daily_brief_deliveries (
    feedDate VARCHAR(10) NOT NULL, subscriberId INT NOT NULL, payload JSON NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
    owner VARCHAR(36) NULL, availableAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receipt VARCHAR(256) NULL, PRIMARY KEY (feedDate, subscriberId)
  )`,
  },
];
