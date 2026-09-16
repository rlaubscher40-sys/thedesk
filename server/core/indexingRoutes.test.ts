import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const m = vi.hoisted(() => ({ editions: vi.fn() }));
vi.mock("../db", () => ({ listEditions: m.editions }));
vi.mock("../markets/discovery", () => ({ getMarketDirectory: async () => ({ markets: [] }) }));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: () => true,
      promises: {
        ...actual.promises,
        readFile: async () => actual.readFileSync("client/index.html", "utf8"),
      },
    },
  };
});
import { registerProductSeoRoutes } from "./productSeo";
import { registerSeoRoutes } from "./seo";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  registerSeoRoutes(app);
  registerProductSeoRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  m.editions.mockReset().mockResolvedValue([]);
});

it("gives every editorial sitemap landing page one self canonical before JavaScript", async () => {
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]!);
  expect(urls).toContain("https://thedesk.au/social");
  expect(urls).toContain("https://thedesk.au/subscribe");
  expect(urls.some((url) => /install|login|search_term/.test(url))).toBe(false);
  for (const url of urls) {
    const response = await fetch(base + new URL(url).pathname);
    const html = await response.text();
    expect(response.status, url).toBe(200);
    expect(html.match(/rel="canonical"/g), url).toHaveLength(1);
    expect(html, url).toContain(`rel="canonical" href="${url}"`);
    expect(html, url).not.toContain('name="robots" content="noindex');
  }
});
it("keeps the social source trail readable without JavaScript", async () => {
  const html = await (await fetch(`${base}/social`)).text();
  expect(html).toContain("Frank Lowy: funding the next centre");
  expect(html).toContain("Westfield Group history");
  expect(html).toContain("not net proceeds");
  expect(html).toContain('id="documentary-stories"');
  expect(html).toContain('href="https://www.scentregroup.com/');
});
it("retires only the literal search placeholder, preserving genuine search URLs", async () => {
  const response = await fetch(`${base}/archive?q=%7Bsearch_term_string%7D`, {
    redirect: "manual",
  });
  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("/archive");
  const realSearch = await fetch(`${base}/archive?q=Perth`, { redirect: "manual" });
  expect(realSearch.status).toBe(200);
  expect(await realSearch.text()).toContain('rel="canonical" href="https://thedesk.au/archive"');
  expect(readFileSync("client/index.html", "utf8")).not.toContain("search_term_string");
});
it("does not cache a truncated sitemap on a database failure", async () => {
  m.editions.mockRejectedValue(new Error("database unavailable"));
  const response = await fetch(`${base}/sitemap.xml`);
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("retry-after")).toBe("60");
});
it("keeps RSS available to readers while excluding the feed itself from search", async () => {
  const response = await fetch(`${base}/feed.xml`);
  expect(response.status).toBe(200);
  expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
  expect(await response.text()).toContain("<rss");
});
