import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null }));
vi.mock("./client", () => ({ getDb: () => state.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { recentSocialReceipts } from "./socialPublication";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)(
  "reads only confirmed, recent, permanent slot receipts from storage",
  async () => {
    const url = new URL(testUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/security_audit_test"
    )
      throw new Error("Requires isolated local test database");
    const connection = await createConnection(testUrl!);
    try {
      await connection.query(
        "CREATE TEMPORARY TABLE job_runs (jobKey VARCHAR(64), runDate VARCHAR(10), status VARCHAR(16), detail TEXT, finishedAt TIMESTAMP NULL)"
      );
      const rows = [
        ["ig-slot-confirmed", "1970-01-01", "success", "confirmed", "2026-09-09 08:00:00"],
        ["ig-slot-running", "1970-01-01", "running", "uncertain", "2026-09-09 09:00:00"],
        ["ig-slot-failed", "1970-01-01", "failed", "failure", "2026-09-09 09:00:00"],
        ["ig-news-source", "1970-01-01", "success", "duplicate story lock", "2026-09-09 09:00:00"],
        ["ig-slot-old", "1970-01-01", "success", "old", "2026-07-01 09:00:00"],
        ["ig-slot-other-date", "2026-09-09", "success", "not permanent", "2026-09-09 09:00:00"],
      ];
      for (const row of rows)
        await connection.execute("INSERT INTO job_runs VALUES (?, ?, ?, ?, ?)", row);
      state.db = drizzle(connection);
      const result = await recentSocialReceipts(new Date("2026-09-09T10:00:00Z"));
      expect(result.map((x) => x.detail)).toEqual(["confirmed"]);
      expect(Object.keys(result[0]!).sort()).toEqual(["detail", "finishedAt"]);
    } finally {
      state.db = null;
      await connection.end();
    }
  }
);
