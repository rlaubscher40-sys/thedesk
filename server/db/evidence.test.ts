import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  offsets: [] as number[],
  limits: [] as number[],
}));
vi.mock("./client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (limit: number) => ({
              offset: async (offset: number) => {
                fixture.offsets.push(offset);
                fixture.limits.push(limit);
                return fixture.rows.slice(offset, offset + limit);
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
    expect(fixture.limits).toEqual(Array(8).fill(100));
  });
  it("retains raw archived records for direct traceability reads", async () => {
    fixture.rows = [row(1, "Sydney Mortgage Awards: Book your hotel room now")];
    expect(await getPropertyEvidence(1)).toEqual(fixture.rows[0]);
  });
});
