import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
const calls = vi.hoisted(() => ({ conditions: [] as unknown[], limits: [] as number[] }));
vi.mock("./client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          calls.conditions.push(condition);
          return {
            orderBy: () => ({
              limit: async (limit: number) => {
                calls.limits.push(limit);
                return [];
              },
            }),
          };
        },
      }),
    }),
  }),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { searchMarketContent, listMarketDiscoveryItems } from "./feed";
import { HOUSING_TOPIC_PATTERN } from "../../shared/marketRelevance";
beforeEach(() => {
  calls.conditions.length = 0;
  calls.limits.length = 0;
});
describe("market candidate query boundaries", () => {
  it("filters housing, dates and locality in the database before applying source limits", async () => {
    await searchMarketContent("Brisbane");
    const queries = calls.conditions.map((condition) =>
      new MySqlDialect().sqlToQuery(condition as SQL)
    );
    expect(calls.limits).toEqual([50, 12]);
    for (const query of queries) {
      expect(query.sql).toContain("REGEXP ?");
      expect(query.params).toContain(HOUSING_TOPIC_PATTERN);
      expect(query.params).toContain("%Brisbane%");
      expect(
        query.params.filter((p) => typeof p === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p))
      ).toHaveLength(2);
    }
    expect(queries[0]!.sql).toContain("'AU', 'PROPERTY'");
  });
  it("uses the same topic gate for public-file counts and keeps user text parameterised", async () => {
    await listMarketDiscoveryItems("2026-06-01", "2026-09-07", 1001);
    const query = new MySqlDialect().sqlToQuery(calls.conditions[0] as SQL);
    expect(query.params).toContain(HOUSING_TOPIC_PATTERN);
    expect(calls.limits).toEqual([1001]);
    calls.conditions.length = 0;
    await searchMarketContent("Port O'Connor");
    const local = new MySqlDialect().sqlToQuery(calls.conditions[0] as SQL);
    expect(local.sql).not.toContain("O'Connor");
    expect(local.params).toContain("%Port O'Connor%");
  });
});
