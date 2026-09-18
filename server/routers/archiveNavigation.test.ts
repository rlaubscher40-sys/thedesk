import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ category: vi.fn(), search: vi.fn() }));
vi.mock("../db", () => ({
  getFeedItemsByCategory: m.category,
  getEditionsByCategory: async () => [],
  searchAllContent: m.search,
}));
import { topicsRouter } from "./topics";
import { searchRouter } from "./search";
const ctx = { req: {}, res: { setHeader: vi.fn() }, user: null } as any;
beforeEach(() => vi.clearAllMocks());
it("returns a bounded page and only advertises an older page when an extra row exists", async () => {
  const rows = [9, 8, 7].map((id) => ({ id, feedDate: "2026-09-18" }));
  m.category.mockResolvedValue(rows);
  const input = { category: "PROPERTY", region: "AU" as const, since: "2026-09-01", limit: 2 };
  const page = await topicsRouter.createCaller(ctx).getByCategory(input);
  expect(m.category).toHaveBeenCalledWith("PROPERTY", 3, input);
  expect(page.feedItems.map((row) => row.id)).toEqual([9, 8]);
  expect(page.nextCursor).toEqual({ feedDate: "2026-09-18", id: 8 });
  m.category.mockResolvedValue([rows[2]]);
  const next = await topicsRouter
    .createCaller(ctx)
    .getByCategory({ ...input, before: page.nextCursor! });
  expect(next.nextCursor).toBeNull();
  expect(m.category).toHaveBeenLastCalledWith("PROPERTY", 3, { ...input, before: page.nextCursor });
});
it("rejects malformed cursors and oversized pages before querying storage", async () => {
  for (const extra of [
    { before: { feedDate: "2026-02-30", id: 1 } },
    { before: { feedDate: "2026-09-18", id: -1 } },
    { limit: 101 },
  ])
    await expect(
      topicsRouter.createCaller(ctx).getByCategory({ category: "PROPERTY", ...extra })
    ).rejects.toThrow();
  expect(m.category).not.toHaveBeenCalled();
});
it("discloses search caps without exposing the sentinel or private edition fields", async () => {
  m.search.mockResolvedValue({
    feedItems: Array.from({ length: 51 }, (_, id) => ({ id })),
    editions: [],
  });
  const result = await searchRouter.createCaller(ctx).all({ query: "rates", region: "AU" });
  expect(result.feedItems).toHaveLength(50);
  expect(result.hasMoreFeedItems).toBe(true);
  expect(result.hasMoreEditions).toBe(false);
  expect(m.search).toHaveBeenCalledWith("rates", { query: "rates", region: "AU", limit: 51 });
});
