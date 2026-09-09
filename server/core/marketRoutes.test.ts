import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "node:http";
vi.mock("../markets/discovery", () => ({ getMarketDirectory: vi.fn() }));
vi.mock("../og/takeCard", () => ({ renderDeskTakeCard: vi.fn() }));
import { getMarketDirectory } from "../markets/discovery";
import { renderDeskTakeCard } from "../og/takeCard";
import { registerMarketSeoRoutes } from "./marketSeo";
import { registerProductSeoRoutes } from "./productSeo";
import { invalidate } from "./cache";
import {
  PUBLIC_MARKETS,
  type MarketDirectory,
  type PublicMarketFile,
} from "../../shared/marketDirectory";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
const handlers = new Map<string, Handler>();
const app = {
  // These cases unit-test the final handler; middleware is exercised over
  // actual local HTTP in the limiter regression below.
  get: (path: string, ...chain: Handler[]) => handlers.set(path, chain.at(-1)!),
} as unknown as Express;
const file: PublicMarketFile = {
  market: PUBLIC_MARKETS[3],
  asOf: "2026-09-07",
  since: "2026-06-10",
  referenceCount: 3,
  publisherCount: 2,
  latestMention: "2026-09-06",
  coverage: "recent",
  indexable: true,
  references: [
    {
      id: 1,
      title: "Perth housing report",
      excerpt: "Perth housing evidence.",
      date: "2026-09-06",
      publisher: "Source",
      sourceUrl: "https://source.test/report",
      category: "PROPERTY",
    },
  ],
};
const directory: MarketDirectory = {
  asOf: file.asOf,
  since: file.since,
  sampleLimit: 1000,
  sampleCapped: false,
  demo: false,
  markets: [file, { ...file, market: PUBLIC_MARKETS[0], coverage: "limited", indexable: false }],
};
function request(slug = "perth") {
  return {
    params: { slug },
    headers: { accept: "text/html" },
    query: { title: "Injected client headline", take: "Fabricated result" },
  } as unknown as Request;
}
function response() {
  const res = { status: vi.fn(), set: vi.fn(), type: vi.fn(), send: vi.fn(), end: vi.fn() };
  Object.values(res).forEach((fn) => fn.mockReturnValue(res));
  return res;
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  invalidate();
  handlers.clear();
  registerMarketSeoRoutes(app);
  registerProductSeoRoutes(app);
  vi.mocked(getMarketDirectory).mockResolvedValue(directory);
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs.promises, "readFile").mockResolvedValue(
    '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>'
  );
});

describe("market page HTTP contracts", () => {
  it("enforces the actual route limiter before data access over HTTP", async () => {
    const realApp = express();
    registerMarketSeoRoutes(realApp);
    const server: Server = createServer(realApp);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local test port");
    try {
      const url = `http://127.0.0.1:${address.port}/markets/not-a-market`;
      for (let i = 0; i < 120; i++) {
        const result = await fetch(url);
        expect(result.status).toBe(404);
        await result.text();
      }
      const limited = await fetch(url);
      expect(limited.status).toBe(429);
      await limited.text();
      expect(getMarketDirectory).not.toHaveBeenCalled();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
  it("keeps the free comparison readable without data and ignores client copy", async () => {
    const res = response();
    await handlers.get("/markets/compare/brisbane-vs-perth")!(
      request(),
      res as unknown as Response,
      vi.fn()
    );
    expect(res.send.mock.calls[0]?.[0]).toContain("evidence gap");
    expect(res.send.mock.calls[0]?.[0]).not.toContain("Injected client headline");
  });
  it("withholds comparison cards without matching evidence", async () => {
    const res = response();
    await handlers.get("/og/markets/compare/brisbane-vs-perth.png")!(
      request(),
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(renderDeskTakeCard).not.toHaveBeenCalled();
  });
  it("returns retryable errors for comparison page and image outages", async () => {
    vi.mocked(getMarketDirectory).mockRejectedValue(new Error("database unavailable"));
    for (const path of [
      "/markets/compare/brisbane-vs-perth",
      "/og/markets/compare/brisbane-vs-perth.png",
    ]) {
      const res = response();
      await handlers.get(path)!(request(), res as unknown as Response, vi.fn());
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    }
  });
  it("renders a supported page and does not accept client-authored trusted copy", async () => {
    const res = response();
    await handlers.get("/markets/:slug")!(request(), res as unknown as Response, vi.fn());
    expect(res.send.mock.calls[0]?.[0]).toContain("Perth housing report");
    expect(res.send.mock.calls[0]?.[0]).not.toContain("Injected client headline");
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "public, max-age=60");
  });
  it("serves metadata to link unfurlers with a wildcard Accept header", async () => {
    const res = response();
    const req = request();
    req.headers.accept = "*/*";
    await handlers.get("/markets/:slug")!(req, res as unknown as Response, vi.fn());
    expect(res.send.mock.calls[0]?.[0]).toContain('property="og:title"');
  });
  it("rejects unknown market routes before touching data", async () => {
    const res = response();
    const next = vi.fn();
    await handlers.get("/markets/:slug")!(request("fake-market"), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalled();
    expect(getMarketDirectory).not.toHaveBeenCalled();
  });
  it("returns a retryable 503 on an outage, not a 200 empty market file", async () => {
    vi.mocked(getMarketDirectory).mockRejectedValue(new Error("database unavailable"));
    const res = response();
    await handlers.get("/markets/:slug")!(request(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.set).toHaveBeenCalledWith("Retry-After", "60");
  });
  it("lists only indexable files and uses source dates instead of today's date", async () => {
    const res = response();
    await handlers.get("/product-sitemap.xml")!(request(), res as unknown as Response, vi.fn());
    const xml = res.send.mock.calls[0]?.[0];
    expect(xml).toContain("/markets/perth</loc><lastmod>2026-09-06</lastmod>");
    expect(xml).not.toContain("/markets/sydney</loc>");
  });
  it("does not cache or publish a truncated sitemap when data fails", async () => {
    vi.mocked(getMarketDirectory).mockRejectedValue(new Error("database unavailable"));
    const res = response();
    await handlers.get("/product-sitemap.xml")!(request(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).not.toHaveBeenCalled();
  });
  it("renders images only from stored evidence and coalesces repeated reads", async () => {
    vi.mocked(renderDeskTakeCard).mockResolvedValue(Buffer.from("fixture image"));
    const handler = handlers.get("/og/markets/:slug.png")!;
    await Promise.all([
      handler(request(), response() as unknown as Response, vi.fn()),
      handler(request(), response() as unknown as Response, vi.fn()),
    ]);
    expect(renderDeskTakeCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(renderDeskTakeCard).mock.calls[0]?.[0].take).toBe(
      "Perth. Perth housing report"
    );
  });
  it("does not publish demo data as a trusted share image", async () => {
    vi.mocked(getMarketDirectory).mockResolvedValue({ ...directory, demo: true });
    const res = response();
    await handlers.get("/og/markets/:slug.png")!(request(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(renderDeskTakeCard).not.toHaveBeenCalled();
  });
});
