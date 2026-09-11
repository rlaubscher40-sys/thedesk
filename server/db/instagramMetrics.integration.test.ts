import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { CATCHUP_STATEMENTS, isHarmless } from "./catchup";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let metrics: typeof import("./instagramPosts");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Use the isolated local test database");
  pool = createPool(testUrl);
  const statements = CATCHUP_STATEMENTS.filter(
    (row) =>
      row.name === "0015 · instagram_posts table" ||
      row.name === "0021 · instagram_posts.coverVariant" ||
      row.name.startsWith("insights ·")
  );
  // Exercise both initial deployment and a repeated boot against real MySQL.
  for (let boot = 0; boot < 2; boot++)
    for (const row of statements) {
      try {
        await pool.query(row.sql);
      } catch (err) {
        if (!isHarmless(err)) throw err;
      }
    }
  await pool.query("DELETE FROM instagram_posts WHERE mediaId = 'metrics-diagnostic-test'");
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  metrics = await import("./instagramPosts");
});
afterAll(async () => {
  await pool?.end();
});

it.skipIf(!testUrl)(
  "persists failure without losing previous counts and permits later recovery",
  async () => {
    await pool.query(`INSERT INTO instagram_posts (mediaId, postType, likes, reach, metricsFetchedAt, createdAt)
    VALUES ('metrics-diagnostic-test', 'daily', 7, 90, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 30 HOUR))`);
    expect(
      await metrics.updateInstagramPostMetrics(
        "metrics-diagnostic-test",
        {},
        { status: "unavailable", reason: "media_unavailable" }
      )
    ).toBe(true);
    const [rows] = await pool.query(
      "SELECT * FROM instagram_posts WHERE mediaId = 'metrics-diagnostic-test'"
    );
    expect((rows as any[])[0]).toMatchObject({
      likes: 7,
      reach: 90,
      metricsStatus: "unavailable",
      metricsError: "media_unavailable",
    });
    expect(
      (await metrics.listInstagramPostsNeedingMetrics(undefined, true)).some(
        (row) => row.mediaId === "metrics-diagnostic-test"
      )
    ).toBe(false);
    await pool.query(
      "UPDATE instagram_posts SET metricsAttemptedAt = DATE_SUB(NOW(), INTERVAL 13 HOUR) WHERE mediaId = 'metrics-diagnostic-test'"
    );
    expect(
      (await metrics.listInstagramPostsNeedingMetrics(undefined, true)).some(
        (row) => row.mediaId === "metrics-diagnostic-test"
      )
    ).toBe(true);
    await metrics.updateInstagramPostMetrics(
      "metrics-diagnostic-test",
      { likes: 0, comments: 0, reach: 100, saved: 2, shares: 1 },
      { status: "complete", reason: null }
    );
    const recovered = (await metrics.listInstagramPosts()).find(
      (row) => row.mediaId === "metrics-diagnostic-test"
    );
    expect(recovered).toMatchObject({
      metricsStatus: "complete",
      metricsError: null,
      likes: 0,
      reach: 100,
      saved: 2,
      shares: 1,
    });
  }
);
