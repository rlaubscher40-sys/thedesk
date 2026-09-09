import { expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  id: 1,
  editionNumber: 1,
  weekOf: "2026-09-08",
  weekRange: "This week",
  substackDraftBody: "SECRET-DRAFT",
  substackDraftTitle: "SECRET-DRAFT",
  headlineVariants: ["SECRET-DRAFT"],
  snippet: "Published snippet",
  futurePrivateField: "SECRET-DRAFT",
}));
vi.mock("../db", () => ({
  getEditionById: async () => fixture,
  getEditionByNumber: async () => fixture,
  searchEditionFullText: async () => [fixture],
  getEditionsByCategory: async () => [fixture],
  getFeedItemsByCategory: async () => [],
  searchAllContent: async () => ({ editions: [fixture], feedItems: [] }),
}));
import { editionsRouter } from "./editions";
import { searchRouter } from "./search";
import { topicsRouter } from "./topics";
const ctx = { req: {}, res: { setHeader: vi.fn() }, user: null } as any;
it("all public edition entry points omit private content", async () => {
  const editions = editionsRouter.createCaller(ctx);
  for (const result of [
    await editions.getById({ editionId: 1 }),
    await editions.getByNumber({ editionNumber: 1 }),
    await editions.search({ query: "week" }),
    await topicsRouter.createCaller(ctx).getByCategory({ category: "PROPERTY" }),
    await searchRouter.createCaller(ctx).all({ query: "week" }),
  ]) {
    expect(JSON.stringify(result)).not.toContain("SECRET-DRAFT");
    expect(JSON.stringify(result)).not.toContain("substackDraft");
  }
});
it("only an authenticated editor can read the full draft", async () => {
  await expect(editionsRouter.createCaller(ctx).editor({ editionId: 1 })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    (
      await editionsRouter
        .createCaller({ ...ctx, user: { role: "admin" } })
        .editor({ editionId: 1 })
    )?.substackDraftBody
  ).toBe("SECRET-DRAFT");
  expect(ctx.res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
});
