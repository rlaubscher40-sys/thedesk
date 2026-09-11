import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null }));
vi.mock("./client", () => ({ getDb: () => state.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { readReelPublicationHistory } from "./reelHistory";

it("distinguishes no eligible topics from unavailable history", async () => {
  expect(await readReelPublicationHistory([])).toEqual([]);
  await expect(readReelPublicationHistory(["rents"])).rejects.toThrow("unavailable");
});

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "reads the latest confirmed post across periods and excludes skips, attempts and other jobs",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Requires isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.query(
        "CREATE TEMPORARY TABLE job_runs (jobKey VARCHAR(64), runDate VARCHAR(10), status VARCHAR(16), detail TEXT, startedAt TIMESTAMP NULL, finishedAt TIMESTAMP NULL)"
      );
      const rows = [
        [
          "rents",
          "2026-06-01",
          "success",
          "Published media 123",
          "2026-09-01 08:30:00",
          "2026-09-01 08:31:00",
        ],
        [
          "rents",
          "2026-07-01",
          "success",
          "Published media 456",
          "2026-09-09 08:30:00",
          "2026-09-09 08:31:00",
        ],
        // Same timestamp: the deterministic period tie-break must keep the
        // media ID attached to that exact row. Never use MAX(detail).
        [
          "rents",
          "2026-05-01",
          "success",
          "Published media 999999",
          "2026-09-09 08:30:00",
          "2026-09-09 08:31:00",
        ],
        ["rents", "2026-08-01", "success", "Skipped", "2026-09-10 08:30:00", "2026-09-10 08:31:00"],
        ["population", "2025-12-01", "success", "Published media 789", "2026-09-02 08:30:00", null],
        ["population", "2026-03-01", "running", "Published media 999", "2026-09-10 08:30:00", null],
        [
          "supply",
          "2026-07-01",
          "failed",
          "Published media 888",
          "2026-09-10 08:30:00",
          "2026-09-10 08:31:00",
        ],
        [
          "borrowing",
          "2026-07-01",
          "success",
          "Published media unknown",
          "2026-09-10 08:30:00",
          "2026-09-10 08:31:00",
        ],
        [
          "unrelated",
          "2026-07-01",
          "success",
          "Published media 111",
          "2026-09-10 08:30:00",
          "2026-09-10 08:31:00",
        ],
      ];
      for (const row of rows)
        await connection.execute("INSERT INTO job_runs VALUES (?, ?, ?, ?, ?, ?)", row);
      state.db = drizzle(connection);
      expect(
        (
          await readReelPublicationHistory(["rents", "population", "supply", "borrowing", "rents"])
        ).sort((a, b) => a.key.localeCompare(b.key))
      ).toEqual([
        {
          key: "population",
          date: "2025-12-01",
          postId: "789",
          publishedAt: new Date("2026-09-02T08:30:00Z"),
        },
        {
          key: "rents",
          date: "2026-07-01",
          postId: "456",
          publishedAt: new Date("2026-09-09T08:31:00Z"),
        },
      ]);
    } finally {
      state.db = null;
      await connection.end();
    }
  }
);
