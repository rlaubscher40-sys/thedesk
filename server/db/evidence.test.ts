import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
const fixture = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  offsets: [] as number[],
  limits: [] as number[],
}));
vi.mock("./client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (condition: SQL) => ({
          orderBy: () => ({
            limit: (limit: number) => ({
              offset: async (offset: number) => {
                fixture.offsets.push(offset);
                fixture.limits.push(limit);
                const params = new MySqlDialect().sqlToQuery(condition).params;
                const term = params.find((p) => typeof p === "string" && /^%.*%$/.test(p)) as
                  | string
                  | undefined;
                const selected = term
                  ? fixture.rows.filter((r) =>
                      `${r.title} ${r.summary}`
                        .toLowerCase()
                        .includes(term.slice(1, -1).toLowerCase())
                    )
                  : fixture.rows;
                return selected.slice(offset, offset + limit);
              },
            }),
          }),
          limit: async (limit: number) => fixture.rows.slice(0, limit),
        }),
      }),
    }),
  }),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import {
  getPropertyEvidence,
  listPropertyMarketEvidence,
  searchPropertyEvidence,
} from "./evidence";
const row = (id: number, title = "Sydney housing supply tightens") => ({
  id,
  title,
  summary: title + " Publisher",
  source: "Publisher",
  sourceUrl: `https://publisher.test/${id}`,
  publishedAt: new Date("2026-09-14"),
  regions: ["NSW"],
});
beforeEach(() => {
  fixture.rows = [];
  fixture.offsets = [];
  fixture.limits = [];
});
describe("evidence read projections", () => {
  it("backfills held and roundup-only search hits before the usable result limit", async () => {
    fixture.rows = [
      row(1, "Sydney Mortgage Awards: Book your hotel room now"),
      {
        ...row(2, "Football results"),
        summary: "Sydney housing rents rise Publisher",
        sourceUrl: "https://news.google.com/rss/articles/2",
      },
      row(3),
      row(4),
    ];
    const results = await searchPropertyEvidence("Sydney", 2);
    expect(results.map((item) => item.id)).toEqual([3, 4]);
    expect(results[0]!.summary).toBe("");
    expect(fixture.offsets).toEqual([0, 2]);
    expect(fixture.rows[2]!.summary).toContain("Publisher");
  });
  it("caps scans even when every matching record is held", async () => {
    fixture.rows = Array.from({ length: 20 }, (_, id) =>
      row(id, "Sydney Mortgage Awards: Book your hotel room now")
    );
    expect(await searchPropertyEvidence("Sydney", 2)).toEqual([]);
    expect(fixture.offsets).toEqual([0, 2, 4]);
  });
  it("filters state samples after excerpt hygiene and deduplicates overlapping states", async () => {
    fixture.rows = [
      row(1),
      row(2, "Sydney Mortgage Awards: Book your hotel room now"),
      {
        ...row(3, "Football results"),
        summary: "Sydney housing supply tightens",
        sourceUrl: "https://news.google.com/rss/articles/3",
      },
    ];
    expect((await listPropertyMarketEvidence()).map((item) => item.id)).toEqual([1]);
    expect(fixture.limits).toEqual([...Array(8).fill(100), ...Array(4).fill(40)]);
  });
  it("recovers regional reporting beyond a busy state sample without duplicating it", async () => {
    fixture.rows = [
      ...Array.from({ length: 150 }, (_, i) => row(i + 1)),
      row(500, "Townsville housing supply expands"),
      { ...row(501, "Newcastle housing approvals increase"), source: "Newcastle Herald" },
      row(502, "Newcastleshire housing report"),
      row(503, "Townsville Mortgage Awards: Book your hotel room now"),
    ];
    const found = await listPropertyMarketEvidence();
    expect(found.filter((r) => r.id === 500)).toHaveLength(1);
    expect(found.filter((r) => r.id === 501)).toHaveLength(1);
    expect(found.some((r) => [502, 503].includes(r.id))).toBe(false);
    expect(found.length).toBe(102);
  });
  it("retains raw archived records for direct traceability reads", async () => {
    fixture.rows = [row(1, "Sydney Mortgage Awards: Book your hotel room now")];
    expect(await getPropertyEvidence(1)).toEqual(fixture.rows[0]);
  });
  it("excludes recruitment and unresolved namesakes from search and market selection but preserves direct reads", async () => {
    const held = [
      {
        ...row(
          278267,
          "Sourcing Program Lead | Melbourne - CBD | Department of Families, Fairness and Housing Careers"
        ),
        source: "jobs.careers.vic.gov.au",
      },
      {
        ...row(99278, "More than 1,000 homes coming after Caivan Perth development wins approval"),
        source: "lanarkleedstoday.ca",
      },
      {
        ...row(
          287372,
          "Builder defends controversial Newcastle housing plans after row over council land deal"
        ),
        source: "Yahoo News UK",
      },
    ].map((r) => ({ ...r, sourceUrl: `https://news.google.com/rss/articles/${r.id}` }));
    fixture.rows = [...held, row(4)];
    expect((await listPropertyMarketEvidence()).map((r) => r.id)).toEqual([4]);
    for (const r of held) {
      fixture.rows = [r];
      expect(await searchPropertyEvidence(r.title, 10)).toEqual([]);
      expect(await getPropertyEvidence(r.id)).toEqual(r);
    }
  });
});
