import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({
  listPropertyMarketEvidence: vi.fn(async () => []),
  listMarketDiscoveryItems: vi.fn(),
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("./absRents", () => ({
  getCityRents: vi.fn(async () => ({ status: "unavailable", retrievedAt: null, observations: [] })),
}));
// Discovery cache behaviour must not depend on live ABS network latency.
vi.mock("./absApprovals", () => ({
  getCityApprovals: vi.fn(async () => ({
    status: "unavailable",
    retrievedAt: null,
    observations: [],
  })),
}));
vi.mock("./absDemographics", () => ({
  getStateDemographics: vi.fn(async () => ({
    status: "unavailable",
    retrievedAt: null,
    observations: [],
  })),
}));
import { listMarketDiscoveryItems } from "../db";
import { invalidate } from "../core/cache";
import { buildMarketDirectory, getMarketDirectory, MARKET_SAMPLE_LIMIT } from "./discovery";

type Item = Parameters<typeof buildMarketDirectory>[0][number];
const item = (id: number, over: Partial<Item> = {}): Item => ({
  id,
  title: `Perth property report ${id}`,
  summary: `Perth rents were reported in release ${id}.`,
  source: "Publisher",
  sourceUrl: `https://source-${id}.test/report`,
  feedDate: "2026-09-07",
  category: "PROPERTY",
  channel: "AU",
  ...over,
});
const perth = (items: Item[], demo = false) =>
  buildMarketDirectory(items, "2026-09-07", demo).markets.find(
    (file) => file.market.slug === "perth"
  )!;
beforeEach(() => {
  vi.clearAllMocks();
  invalidate();
});

describe("public market discovery", () => {
  it("excludes stored spam and recycled updates even when their feed date is recent", () => {
    const file = perth([
      item(1),
      item(2, {
        title: "Perth Housing Market Update | April 2026 Emergency Alert Today (7Y9mHxXuGJ)",
        source: "MSHALE",
      }),
      item(3, { title: "Perth housing market update April 2026" }),
    ]);
    expect(file.references.map((row) => row.id)).toEqual([1]);
  });
  it("keeps Canadian Perth and overseas housing out and retains actual evidence routes", () => {
    const file = perth([
      item(1, { title: "Ontario approves Perth housing redevelopment" }),
      item(2, {
        title: "Major housing project approved in Perth",
        sourceUrl: "https://cbc.ca/news/a",
      }),
      item(-3, { href: "/evidence/3" }),
      item(-848, {
        title: "Major housing project approved on historic Perth golf course",
        source: "CBC",
        sourceUrl: "https://news.google.com/rss/articles/fixture",
        href: "/evidence/848",
      }),
    ]);
    expect(file.references).toHaveLength(1);
    expect(file.references[0]?.href).toBe("/evidence/3");
  });
  it("uses exact local mentions, not substrings, foreign lanes or unrelated categories", () => {
    const file = perth([
      item(1),
      item(2, { title: "Perthshire prices", summary: "No local mention" }),
      item(3, { channel: "GLOBAL" }),
      item(4, { category: "TECH" }),
      item(5, { channel: "PROPERTY" }),
    ]);
    expect(file.referenceCount).toBe(2);
    expect(file.references.map((ref) => ref.id)).toEqual([5, 1]);
    expect(file.coverage).toBe("limited");
  });
  it("collapses repeated URLs including tracking parameters and identical headlines", () => {
    const file = perth([
      item(1, { sourceUrl: "https://source.test/article?utm_source=ig#view" }),
      item(2, { sourceUrl: "https://source.test/article?fbclid=anything" }),
      item(3, { title: "  Perth property report 2 " }),
    ]);
    expect(file.referenceCount).toBe(1);
  });
  it("rejects invalid, future and out-of-window dates without inventing freshness", () => {
    expect(
      perth([
        item(1),
        item(2, { feedDate: "2026-09-08" }),
        item(3, { feedDate: "2026-02-30" }),
        item(4, { feedDate: "2026-06-09" }),
      ]).referenceCount
    ).toBe(1);
    expect(() => buildMarketDirectory([], "2026-02-30")).toThrow("Invalid directory date");
  });
  it("collapses duplicate groups even when an older record connects two newer copies", () => {
    const file = perth([
      item(3, { sourceUrl: "https://a.test/1" }),
      item(2, { sourceUrl: "https://b.test/1" }),
      item(1, { title: "Perth property report 2", sourceUrl: "https://a.test/1" }),
    ]);
    expect(file.referenceCount).toBe(1);
    expect(file.references[0]?.id).toBe(3);
  });
  it("makes limited, older, empty and demo coverage non-indexable", () => {
    expect(perth([])).toMatchObject({ coverage: "none", indexable: false, latestMention: null });
    expect(perth([item(1)])).toMatchObject({ coverage: "limited", indexable: false });
    expect(perth([item(1, { feedDate: "2026-08-08" })])).toMatchObject({
      coverage: "older",
      indexable: false,
    });
    expect(perth([item(1), item(2), item(3)], true).indexable).toBe(false);
    expect(perth([item(1), item(2), item(3)])).toMatchObject({
      coverage: "recent",
      indexable: true,
    });
  });
  it("counts source websites, not repeated publisher labels or unsafe links", () => {
    const file = perth([
      item(1, { sourceUrl: "https://www.source.test/1" }),
      item(2, { sourceUrl: "https://source.test/2", source: "Different label" }),
      item(3, { sourceUrl: "javascript:alert(1)" }),
      item(4, { sourceUrl: "https://user:pass@other.test/a" }),
    ]);
    expect(file.publisherCount).toBe(1);
    expect(file.indexable).toBe(false);
    expect(file.references.filter((ref) => ref.sourceUrl === null)).toHaveLength(2);
  });
  it("keeps literal local excerpts from long summaries and limits visible references", () => {
    const summary =
      "Other news. ".repeat(80) +
      "Perth rents increased in this report. " +
      "More news. ".repeat(80);
    const file = perth(Array.from({ length: 16 }, (_, index) => item(index, { summary })));
    expect(file.referenceCount).toBe(16);
    expect(file.references).toHaveLength(12);
    expect(file.references[0]?.excerpt).toContain("Perth rents increased in this report.");
    expect(file.references[0]?.excerpt.length).toBeLessThanOrEqual(362);
  });
  it("orders markets by recency, not counts or a manufactured market score", () => {
    const directory = buildMarketDirectory(
      [
        item(1),
        item(2),
        item(3),
        item(4, {
          title: "Brisbane property report",
          summary: "Brisbane rents",
          feedDate: "2026-09-06",
        }),
      ],
      "2026-09-07"
    );
    expect(directory.markets.slice(0, 2).map((file) => file.market.name)).toEqual([
      "Perth",
      "Brisbane",
    ]);
    expect(directory.markets[0]).not.toHaveProperty("score");
  });
  it("exposes the sample cap rather than presenting sampled counts as full coverage", () => {
    const directory = buildMarketDirectory(
      Array.from({ length: MARKET_SAMPLE_LIMIT + 1 }, (_, id) => item(id)),
      "2026-09-07"
    );
    expect(directory.sampleCapped).toBe(true);
    expect(directory.markets[0]?.referenceCount).toBe(MARKET_SAMPLE_LIMIT);
  });
  it("coalesces concurrent readers into one bounded query", async () => {
    vi.mocked(listMarketDiscoveryItems).mockResolvedValue([]);
    await Promise.all([getMarketDirectory(), getMarketDirectory(), getMarketDirectory()]);
    expect(listMarketDiscoveryItems).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listMarketDiscoveryItems).mock.calls[0]?.[2]).toBe(1001);
  });
});
