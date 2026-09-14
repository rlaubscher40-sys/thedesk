import { index, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Append-only application history, starting at deployment. Not a backfill of
 * historical consent and not a tamper-proof record against database admins. */
export const subscriberConsentEvents = mysqlTable(
  "subscriber_consent_events",
  {
    id: int("id").autoincrement().primaryKey(),
    subscriberId: int("subscriberId").notNull(),
    event: varchar("event", { length: 16 }).notNull(),
    noticeVersion: varchar("noticeVersion", { length: 32 }),
    source: varchar("source", { length: 64 }),
    requestedAt: timestamp("requestedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_consent_subscriber").on(t.subscriberId, t.createdAt)]
);
export const CONSENT_EVENT_DDL = {
  name: "legal · consent history",
  sql: `CREATE TABLE subscriber_consent_events (
  id INT AUTO_INCREMENT PRIMARY KEY, subscriberId INT NOT NULL, event VARCHAR(16) NOT NULL,
  noticeVersion VARCHAR(32) NULL, source VARCHAR(64) NULL, requestedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consent_subscriber (subscriberId, createdAt))`,
};
