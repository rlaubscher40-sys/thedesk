import { beforeEach, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { matchesArchiveFilters } from "../../shared/archiveScope";
const calls = vi.hoisted(() => ({ conditions: [] as SQL[], limits: [] as number[] }));
vi.mock("./client", () => {
  const select = () => ({
    from: () => ({
      where: (condition: SQL) => {
        calls.conditions.push(condition);
        return {
          orderBy: () => ({
            limit: async (limit: number) => {
              calls.limits.push(limit);
              return [];
            },
          }),
          groupBy: async () => [],
        };
      },
    }),
  });
  return { getDb: () => ({ select, selectDistinct: select }) };
});
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import {
  getCategoryHeat,
  getFeedItemsByCategory,
  getRecentFeedDates,
  searchAllContent,
} from "./feed";
beforeEach(() => {
  calls.conditions.length = 0;
  calls.limits.length = 0;
});
it("scopes counts, category browse and search in SQL before limiting results", async () => {
  const filters = { region: "AU" as const, since: "2026-09-01" };
  await getCategoryHeat(3650, filters);
  await getFeedItemsByCategory("PROPERTY", 3, filters);
  await searchAllContent("Sydney", { ...filters, category: "PROPERTY" });
  const queries = calls.conditions.map((sql) => new MySqlDialect().sqlToQuery(sql));
  for (const q of [queries[0]!, queries[1]!, queries[3]!]) {
    expect(q.sql).toContain("IN ('AU', 'PROPERTY')");
    expect(q.sql).toContain("<> 'HOLD'");
    expect(q.params).toContain("2026-09-01");
  }
  expect(calls.limits).toEqual([3, 50, 50]);
});
it("includes international coverage explicitly and never admits held stories", async () => {
  await getFeedItemsByCategory("PROPERTY", 100, { region: "INTERNATIONAL" });
  expect(new MySqlDialect().sqlToQuery(calls.conditions[0]!).sql).toContain(
    "NOT IN ('AU', 'PROPERTY')"
  );
  expect(
    matchesArchiveFilters(
      { channel: "BUSINESS", feedDate: "2026-09-13" },
      { region: "INTERNATIONAL" }
    )
  ).toBe(true);
  for (const region of ["AU", "INTERNATIONAL", "ALL"] as const)
    expect(matchesArchiveFilters({ channel: "HOLD", feedDate: "2026-09-13" }, { region })).toBe(
      false
    );
});
it("finds available dates within the requested lane, excluding future dates", async () => {
  await getRecentFeedDates(14, "PROPERTY");
  const query = new MySqlDialect().sqlToQuery(calls.conditions[0]!);
  expect(query.params).toContain("PROPERTY");
  expect(query.sql).toContain("<= ?");
  expect(query.sql).toContain("<> 'HOLD'");
  expect(calls.limits).toEqual([14]);
});
