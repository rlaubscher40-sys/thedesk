import { beforeEach, expect, it, vi } from "vitest";
import type { Express } from "express";
const m = vi.hoisted(() => ({ story: vi.fn(), edition: vi.fn(), asset: vi.fn(), hero: vi.fn() }));
vi.mock("../db", () => ({
  getFeedItemById: m.story,
  getEditionByNumber: m.edition,
  getLatestEditionAsset: m.asset,
  getHeroLibraryBytes: m.hero,
}));
vi.mock("node:fs", () => ({
  default: {
    existsSync: () => true,
    promises: {
      readFile: async () =>
        '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>',
    },
  },
}));
import { registerSeoRoutes } from "./seo";
import { registerDistributionSeoRoutes } from "./distributionSeo";
import { isKnownRoute } from "./spaShell";
function routes(register: (app: Express) => void) {
  const handlers = new Map<string, Function>();
  register({
    get: (path: string, ...rest: Function[]) => handlers.set(path, rest.at(-1)!),
  } as unknown as Express);
  return handlers;
}
const seo = routes(registerSeoRoutes),
  distribution = routes(registerDistributionSeoRoutes);
async function request(handlers: Map<string, Function>, route: string, value: string) {
  const res = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    send: vi.fn(),
    redirect: vi.fn(),
  };
  const next = vi.fn();
  await handlers.get(route)!(
    { params: { id: value, n: value, kind: "hero" }, headers: { accept: "*/*" }, query: {} },
    res,
    next
  );
  return { res, next };
}
beforeEach(() => vi.clearAllMocks());
it("returns a noindex 404 for malformed story and edition IDs without fetching a different record", async () => {
  for (const value of [
    "3930052invalid",
    "1.2",
    "1e2",
    "0x10",
    "0",
    "-1",
    " 12",
    "9007199254740992",
  ]) {
    for (const route of ["/story/:id", "/editions/:n"]) {
      const { res, next } = await request(seo, route, value);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0]![0]).toContain("noindex");
      expect(next).not.toHaveBeenCalled();
    }
    for (const prefix of ["/story/", "/editions/", "/evidence/"])
      expect(isKnownRoute(prefix + value)).toBe(false);
  }
  expect(m.story).not.toHaveBeenCalled();
  expect(m.edition).not.toHaveBeenCalled();
});
it("preserves complete positive numeric IDs and the missing-record response", async () => {
  for (const value of ["42", "0042"]) {
    await request(seo, "/story/:id", value);
    await request(seo, "/editions/:n", value);
    expect(m.story).toHaveBeenLastCalledWith(42);
    expect(m.edition).toHaveBeenLastCalledWith(42);
    expect(isKnownRoute(`/story/${value}`)).toBe(true);
  }
});
it("rejects malformed image IDs before lookup and never renders a different story's share card", async () => {
  for (const route of [
    "/api/images/edition/:id/:kind",
    "/api/images/hero-library/:id",
    "/og/editions/:n.png",
  ]) {
    const { res } = await request(seo, route, "42invalid");
    expect(res.status).toHaveBeenCalledWith(400);
  }
  for (const value of ["42invalid", "0x2a", "42e0", "9007199254740992"]) {
    const meta = await request(distribution, "/story/:id", value);
    expect(meta.next).toHaveBeenCalledOnce();
    const image = await request(distribution, "/og/story/:id.jpg", value);
    expect(image.res.redirect).toHaveBeenCalledWith(302, "/og-card.png");
  }
  expect(m.story).not.toHaveBeenCalled();
  expect(m.edition).not.toHaveBeenCalled();
  expect(m.asset).not.toHaveBeenCalled();
  expect(m.hero).not.toHaveBeenCalled();
});
