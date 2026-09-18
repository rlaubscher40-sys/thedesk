import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const item = Object.freeze({
    id: 34,
    feedDate: "2026-09-18",
    category: "PROPERTY",
    channel: "AU",
    title: "Rate decision",
    source: "Publisher",
    sourceUrl: "https://example.com/report",
    summary:
      "The RBA held rates at 4.35%. Get our breaking news email, free app or daily news podcast The next decision remains uncertain. Continue reading...",
  });
  return { item };
});
vi.mock("../db", () => ({
  listFeedItems: async () => [m.item],
  listRecentLocalFeed: async () => [m.item],
  getFeedItemById: async () => m.item,
  getFeedItemsByIds: async () => [m.item],
  listFeedItemsBetween: async () => [m.item],
  listArchive: async () => [m.item],
  getFeedItemsByCategory: async () => [m.item],
  getEditionsByCategory: async () => [],
  getCategoryHeat: async () => [{ category: "PROPERTY", total: 1 }],
  searchAllContent: async () => ({
    feedItems: [{ ...m.item, snippet: "…free app or daily news podcast The next decision…" }],
    editions: [],
  }),
}));
import { feedRouter } from "./feed";
import { topicsRouter } from "./topics";
import { searchRouter } from "./search";
const ctx = { req: {}, res: { setHeader: vi.fn() }, user: null } as any;

it("cleans every public feed journey and search snippets without rewriting archived records", async () => {
  const feed = feedRouter.createCaller(ctx);
  const topics = topicsRouter.createCaller(ctx);
  const [story, daily, recent, saved, week, archive, category, byBeat, search] = await Promise.all([
    feed.getById({ id: 34 }),
    feed.getByDate(),
    feed.recentLocal({ channel: "AU" }),
    feed.getByIds({ ids: [34] }),
    feed.getByWeek(),
    feed.archive({}),
    topics.getByCategory({ category: "PROPERTY", region: "AU" }),
    topics.recentByCategory({ region: "AU" }),
    searchRouter.createCaller(ctx).all({ query: "rates", region: "AU" }),
  ]);
  const rows = [
    story!,
    ...daily,
    ...recent,
    ...saved,
    ...week,
    ...archive,
    ...category.feedItems,
    ...byBeat.PROPERTY!,
    ...search.feedItems,
  ];
  for (const item of rows) {
    expect(item.summary).toBe("The RBA held rates at 4.35%. The next decision remains uncertain.");
    expect(item.sourceUrl).toBe(m.item.sourceUrl);
    expect(item.title).toBe(m.item.title);
  }
  expect(search.feedItems[0]!.snippet).toContain("rates at 4.35%");
  expect(search.feedItems[0]!.snippet).not.toMatch(/free app|Continue reading/);
  expect(m.item.summary).toContain("Get our breaking news email");
});
