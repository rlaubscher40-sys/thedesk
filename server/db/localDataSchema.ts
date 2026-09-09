import {
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import type { LocalDataset } from "../../shared/localData";

/** Bounded release snapshots. Observation payloads are immutable; conditional-download
 * metadata may be refreshed without changing the observation or retrieval dates.
 * A snapshot is published in one insert, so visitors can never read half a file. */
export const localDataSnapshots = mysqlTable(
  "local_data_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceKey: varchar("sourceKey", { length: 48 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    period: varchar("period", { length: 10 }).notNull(),
    payload: json("payload").$type<LocalDataset>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("idx_local_data_source").on(table.sourceKey, table.id)],
);

export const localDataHealth = mysqlTable("local_data_health", {
  sourceKey: varchar("sourceKey", { length: 48 }).primaryKey(),
  checkedAt: timestamp("checkedAt").notNull(),
  lastSuccessAt: timestamp("lastSuccessAt"),
  error: text("error"),
});
export const LOCAL_DATA_DDL = [
  {
    name: "local data · snapshots",
    sql: `CREATE TABLE local_data_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY, sourceKey VARCHAR(48) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL, period VARCHAR(10) NOT NULL, payload JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_local_data_source (sourceKey, id)
  )`,
  },
  {
    name: "local data · health",
    sql: `CREATE TABLE local_data_health (
    sourceKey VARCHAR(48) PRIMARY KEY, checkedAt TIMESTAMP NOT NULL,
    lastSuccessAt TIMESTAMP NULL, error TEXT NULL
  )`,
  },
];
