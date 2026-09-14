import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let publication: typeof import("../instagram/carouselStoryReceipt");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Story tests require the isolated local test database");
  pool = createPool(testUrl);
  await pool.query(`CREATE TABLE IF NOT EXISTS job_runs (
    id INT AUTO_INCREMENT PRIMARY KEY, jobKey VARCHAR(64) NOT NULL,
    runDate VARCHAR(10) NOT NULL, status VARCHAR(16) NOT NULL,
    attempts INT NOT NULL DEFAULT 1, detail TEXT,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt TIMESTAMP NULL,
    UNIQUE KEY uq_job_runs_key_date (jobKey, runDate))`);
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  publication = await import("../instagram/carouselStoryReceipt");
});
afterAll(async () => {
  await pool?.end();
});
it.skipIf(!testUrl)(
  "persists a Story receipt in VARCHAR(64) and only publishes once across competing workers",
  async () => {
    const key = publication.carouselStoryKey("999000111222", 999888);
    await pool.query("DELETE FROM job_runs WHERE jobKey = ? AND runDate = '1970-01-01'", [key]);
    try {
      const publish = vi.fn().mockResolvedValue("123456789");
      const results = await Promise.allSettled(
        Array.from({ length: 3 }, () =>
          publication.publishCarouselStoryOnce("999000111222", 999888, publish)
        )
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(publish).toHaveBeenCalledOnce();
      const [rows] = await pool.query("SELECT status, detail FROM job_runs WHERE jobKey = ?", [
        key,
      ]);
      expect(rows).toMatchObject([
        {
          status: "success",
          detail: JSON.stringify({
            carouselId: "999000111222",
            sourceId: 999888,
            storyId: "123456789",
          }),
        },
      ]);
    } finally {
      await pool.query("DELETE FROM job_runs WHERE jobKey = ? AND runDate = '1970-01-01'", [key]);
    }
  }
);
