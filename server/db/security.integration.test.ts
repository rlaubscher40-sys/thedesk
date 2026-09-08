import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let security: typeof import("./security");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Security integration tests require the isolated local test database");
  pool = createPool(testUrl);
  await pool.query("DROP TABLE IF EXISTS security_limits");
  await pool.query("DROP TABLE IF EXISTS admin_sessions");
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  security = await import("./security");
  for (const ddl of security.SECURITY_DDL) await pool.query(ddl.sql);
});
afterAll(async () => {
  await pool?.end();
});
it.skipIf(!testUrl)(
  "serializes concurrent budgets and persists session revocation in MySQL",
  async () => {
    const expiresMs = Date.now() + 60000;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        security.chargeBudgets([{ key: "integration-shared", limit: 3, expiresMs }])
      )
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await security.budgetUsed("integration-shared")).toBe(3);
    // A rejected multi-limit transaction cannot consume the other limit.
    expect(
      await security.chargeBudgets([
        { key: "integration-other", limit: 10, expiresMs },
        { key: "integration-shared", limit: 3, expiresMs },
      ])
    ).toBe(false);
    expect(await security.budgetUsed("integration-other")).toBe(0);
    await security.saveAdminSession("a".repeat(64), expiresMs);
    expect(await security.hasAdminSession("a".repeat(64))).toBe(true);
    await security.deleteAdminSession("a".repeat(64));
    expect(await security.hasAdminSession("a".repeat(64))).toBe(false);
    await security.refundBudget("integration-shared");
    expect(await security.chargeBudgets([{ key: "integration-shared", limit: 3, expiresMs }])).toBe(
      true
    );
  }
);
