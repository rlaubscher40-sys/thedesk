import { int, json, mysqlTable, timestamp } from "drizzle-orm/mysql-core";
import type { EvidenceFingerprint } from "../../shared/storyEvidenceDuplicate";

// Separate private table: public feed rows never contain original article
// text or fingerprints. Hashes survive the enrichment job's input cleanup.
export const feedEvidenceFingerprints = mysqlTable("feed_evidence_fingerprints", {
  feedItemId: int("feedItemId").primaryKey(),
  fingerprint: json("fingerprint").$type<EvidenceFingerprint>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const FEED_EVIDENCE_DDL = [
  {
    name: "editorial · private evidence fingerprints",
    sql: "CREATE TABLE feed_evidence_fingerprints (feedItemId INT PRIMARY KEY, fingerprint JSON NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_feed_evidence_created (createdAt))",
  },
];
