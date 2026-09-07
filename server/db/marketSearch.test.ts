import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { HOUSING_PATTERN } from "../../shared/housingEvidence";
const { queries, getDb } = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  getDb: vi.fn(),
}));
vi.mock("./client", () => ({ getDb }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { searchAllContent, listMarketDiscoveryItems } from "./feed";
beforeEach(() => {
  queries.length = 0;
  getDb.mockReturnValue(
    drizzle(async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    })
  );
});
describe("housing candidate SQL", () => {
  it("filters housing before the database result cap while keeping ordinary search broad", async () => {
    await searchAllContent("Perth", { housingOnly: true });
    const query = queries.find((q) => q.sql.includes("daily_feed_items"))!;
    expect(query.sql).toMatch(/where .*REGEXP .*order by .*limit /);
    expect(query.params).toContain(HOUSING_PATTERN);
    expect(query.params).toContain("%Perth%");
    queries.length = 0;
    await searchAllContent("Perth");
    expect(queries.every((q) => !q.sql.includes("REGEXP"))).toBe(true);
  });
  it("filters discovery subjects before sampling the archive", async () => {
    await listMarketDiscoveryItems("2026-06-10", "2026-09-07", 1001);
    expect(queries[0]?.sql).toMatch(/where .*REGEXP .*order by .*limit /);
    expect(queries[0]?.params).toContain(HOUSING_PATTERN);
  });
});
