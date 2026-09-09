import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let runs: typeof import("./collectionRuns");
const day = "2026-09-09";
const key = "daily-metrics";
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/security_audit_test"
  )
    throw new Error(
      "Collection tests require the isolated local test database",
    );
  pool = createPool(testUrl);
  await pool.query(`CREATE TABLE IF NOT EXISTS job_runs (
    id INT AUTO_INCREMENT PRIMARY KEY, jobKey VARCHAR(64) NOT NULL,
    runDate VARCHAR(10) NOT NULL, status VARCHAR(16) NOT NULL,
    attempts INT NOT NULL DEFAULT 1, detail TEXT,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt TIMESTAMP NULL,
    UNIQUE KEY uq_job_runs_key_date (jobKey, runDate))`);
  await pool.query(
    "CREATE TABLE IF NOT EXISTS collection_write_probe (value INT NOT NULL)",
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  runs = await import("./collectionRuns");
});
beforeEach(async () => {
  if (!pool) return;
  await pool.query("DELETE FROM job_runs WHERE jobKey = ? AND runDate = ?", [
    key,
    day,
  ]);
  await pool.query("DELETE FROM collection_write_probe");
});
afterAll(async () => {
  await pool?.end();
});

it.skipIf(!testUrl)(
  "allows one replica to claim and observes durable retry backoff",
  async () => {
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => runs.claimCollectionRun(key, day)),
    );
    const lease = claims.find(Boolean)!;
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(lease.attempt).toBe(1);
    await runs.finishCollectionRun(lease, "failed", "source unavailable");
    expect(await runs.claimCollectionRun(key, day)).toBeNull();
    const later = new Date(Date.now() + 16 * 60_000);
    const second = await runs.claimCollectionRun(key, day, 3, later);
    expect(second?.attempt).toBe(2);
    expect(await runs.finishCollectionRun(lease, "success")).toBe(false);
    expect(await runs.finishCollectionRun(second!, "success")).toBe(true);
    expect(
      await runs.claimCollectionRun(
        key,
        day,
        3,
        new Date(later.getTime() + 3600_000),
      ),
    ).toBeNull();
  },
);

it.skipIf(!testUrl)(
  "reclaims an interrupted worker and rejects its late data and completion",
  async () => {
    const first = await runs.claimCollectionRun(
      key,
      day,
      3,
      new Date(Date.now() - 16 * 60_000),
    );
    const next = await runs.claimCollectionRun(key, day);
    expect(next?.attempt).toBe(2);
    await expect(
      runs.runCollectionAttempt(first!, async () => {
        await runs.withCollectionWrite(async (tx) => {
          await tx.execute(sql`INSERT INTO collection_write_probe VALUES (1)`);
        });
      }),
    ).rejects.toThrow("no longer owns");
    expect(await runs.finishCollectionRun(first!, "failed")).toBe(false);
    await runs.runCollectionAttempt(next!, async () => {
      await runs.withCollectionWrite(async (tx) => {
        await tx.execute(sql`INSERT INTO collection_write_probe VALUES (2)`);
      });
    });
    const [rows] = await pool.query("SELECT value FROM collection_write_probe");
    expect(rows).toEqual([{ value: 2 }]);
  },
);

it.skipIf(!testUrl)(
  "rolls back data written during a timed-out transaction",
  async () => {
    const lease = await runs.claimCollectionRun(key, day);
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let writeTask!: Promise<void>;
    const run = runs.runCollectionAttempt(
      lease!,
      () => {
        writeTask = runs.withCollectionWrite(async (tx) => {
          await tx.execute(sql`INSERT INTO collection_write_probe VALUES (3)`);
          entered();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        });
        return writeTask;
      },
      300,
    );
    const failed = expect(run).rejects.toThrow("time limit");
    await enteredPromise;
    await failed;
    release();
    await expect(writeTask).rejects.toThrow("time limit");
    const [rows] = await pool.query("SELECT value FROM collection_write_probe");
    expect(rows).toEqual([]);
  },
);

it.skipIf(!testUrl)(
  "does not steal a live lock or leave an exhausted expired attempt running",
  async () => {
    const lease = await runs.claimCollectionRun(key, day, 1);
    expect(lease?.attempt).toBe(1);
    expect(await runs.claimCollectionRun(key, day, 1)).toBeNull();
    expect(
      await runs.claimCollectionRun(
        key,
        day,
        1,
        new Date(Date.now() + 16 * 60_000),
      ),
    ).toBeNull();
    const [rows] = await pool.query(
      "SELECT status, attempts FROM job_runs WHERE jobKey = ? AND runDate = ?",
      [key, day],
    );
    expect(rows).toEqual([{ status: "failed", attempts: 1 }]);
    await expect(
      runs.claimCollectionRun("instagram-daily", day),
    ).rejects.toThrow("Only data collection");
  },
);
