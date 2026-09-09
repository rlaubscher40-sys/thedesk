import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { COLLECTION_EFFICIENCY_DDL } from "./collectionEfficiencySchema";
import type { InsertDailyFeedItem } from "./schema";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let claims: typeof import("./feedClaims");
let transfers: typeof import("./localTransfers");
let feed: typeof import("./feed");
const item: InsertDailyFeedItem = {
  feedDate: "2026-09-09",
  title: "Concurrent article",
  source: "concurrency-test",
  sourceUrl: "https://concurrency-test.example/article?id=1",
  summary: "Verified excerpt",
  category: "PROPERTY",
  channel: "PROPERTY",
};
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Use the isolated local test database");
  pool = createPool(testUrl);
  for (const ddl of COLLECTION_EFFICIENCY_DDL)
    await pool.query(ddl.sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));
  await pool.query(`CREATE TABLE IF NOT EXISTS daily_feed_items (
    id INT AUTO_INCREMENT PRIMARY KEY, sourceTiming JSON, feedDate VARCHAR(10) NOT NULL,
    title VARCHAR(512) NOT NULL, source VARCHAR(256) NOT NULL, sourceUrl TEXT,
    summary TEXT NOT NULL, category VARCHAR(64) NOT NULL, channel VARCHAR(32) NOT NULL DEFAULT 'AU',
    imageUrl TEXT, partnerTag TEXT, sayThis TEXT, whyItMatters TEXT, counterpoint TEXT,
    corroborationCount INT NOT NULL DEFAULT 1, corroboratingSources JSON, threadParentId INT,
    threadParentTitle TEXT, rubensNote TEXT, priority INT NOT NULL DEFAULT 50,
    promotedToEdition BOOLEAN DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query("DELETE FROM daily_feed_items WHERE source = 'concurrency-test'");
  await pool.query("DELETE FROM feed_ingest_claims");
  await pool.query("DELETE FROM local_transfer_stats");
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  claims = await import("./feedClaims");
  transfers = await import("./localTransfers");
  feed = await import("./feed");
});
afterAll(async () => {
  await pool?.end();
});

it.skipIf(!testUrl)(
  "gives only one simultaneous worker an inserted ID, including tracking variants",
  async () => {
    const now = new Date("2026-09-09T00:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        claims.insertFeedOnce(
          { ...item, sourceUrl: `${item.sourceUrl}&utm_source=worker${i}` },
          now
        )
      )
    );
    expect(results.filter((id) => id > 0)).toHaveLength(1);
    expect(results.filter((id) => id === 0)).toHaveLength(5);
    const [rows] = await pool.query(
      "SELECT id FROM daily_feed_items WHERE source = 'concurrency-test'"
    );
    expect(rows).toHaveLength(1);
  }
);
it.skipIf(!testUrl)("rolls failed insertion back so a retry can win", async () => {
  const row = { ...item, sourceUrl: "https://concurrency-test.example/retry" };
  await expect(claims.insertFeedOnce({ ...row, title: "x".repeat(513) })).rejects.toThrow();
  const [locks] = await pool.query("SELECT identity FROM feed_ingest_claims WHERE identity=?", [
    claims.feedClaimIdentity(row),
  ]);
  expect(locks).toHaveLength(0);
  expect(await claims.insertFeedOnce(row)).toBeGreaterThan(0);
});
it.skipIf(!testUrl)("keeps result indices and duplicate/failure counts distinct", async () => {
  const row = { ...item, sourceUrl: "https://concurrency-test.example/indices" };
  const result = await feed.createFeedItems([
    row,
    row,
    { ...row, sourceUrl: "https://concurrency-test.example/invalid", title: "x".repeat(513) },
  ]);
  expect(result.ids[0]).toBeGreaterThan(0);
  expect(result.ids.slice(1)).toEqual([0, 0]);
  expect(result).toMatchObject({ duplicateCount: 1, failedCount: 1 });
});
it.skipIf(!testUrl)(
  "preserves the 14-day acceptance window without resetting it on a duplicate",
  async () => {
    const row = { ...item, sourceUrl: "https://concurrency-test.example/window" };
    expect(await claims.insertFeedOnce(row, new Date("2026-08-01"))).toBeGreaterThan(0);
    expect(await claims.insertFeedOnce(row, new Date("2026-08-14"))).toBe(0);
    expect(await claims.insertFeedOnce(row, new Date("2026-08-15"))).toBeGreaterThan(0);
  }
);
it.skipIf(!testUrl)(
  "atomically counts concurrent responses and labels unknown estimates separately",
  async () => {
    const now = new Date("2026-09-09T00:00:00Z");
    await Promise.all(
      Array.from({ length: 5 }, () =>
        transfers.recordLocalTransfer(
          "nsw-bond-rents",
          { status: "downloaded", bodyBytes: 100 },
          now
        )
      )
    );
    await Promise.all(
      Array.from({ length: 3 }, () =>
        transfers.recordLocalTransfer(
          "nsw-bond-rents",
          { status: "unchanged", previousBodyBytes: 100 },
          now
        )
      )
    );
    await transfers.recordLocalTransfer("nsw-bond-rents", { status: "unchanged" }, now);
    await transfers.recordLocalTransfer(
      "nsw-bond-rents",
      { status: "downloaded", bodyBytes: 500 },
      new Date("2026-07-01")
    );
    expect(
      (await transfers.readLocalTransfers(now)).find((r) => r.sourceKey === "nsw-bond-rents")
    ).toMatchObject({
      downloads: 5,
      unchanged: 4,
      bodyBytes: 500,
      estimatedAvoidedBytes: 300,
      unknownSize: 1,
    });
  }
);
