import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
const source = readFileSync("client/public/sw.js", "utf8");
const origin = "https://thedesk.au";
function worker(fetcher = vi.fn().mockResolvedValue(new Response("ok"))) {
  const handlers: Record<string, (event: any) => void> = {};
  const stored = new Map<string, Response>();
  const keyOf = (key: string | Request) => typeof key === "string" ? new URL(key, origin).href : key.url;
  const cache = {
    put: vi.fn(async (key, response) => { stored.set(keyOf(key), response); }),
    keys: async () => [...stored.keys()].map((key) => new Request(key)),
    delete: async (key: Request) => stored.delete(key.url),
    addAll: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    match: vi.fn(async (key) => stored.get(keyOf(key))?.clone()),
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["thedesk-shell-v3", "another-app"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, { self: { location: { origin }, addEventListener: (name: string, fn: any) => { handlers[name] = fn; }, clients: { claim }, skipWaiting: vi.fn() }, caches, fetch: fetcher, URL, Response, AbortController, setTimeout, clearTimeout });
  function request(path: string, mode = "cors", init: RequestInit = {}) {
    const raw = new Request(origin + path, init);
    const waits: Promise<any>[] = [];
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: { url: raw.url, method: raw.method, headers: raw.headers, mode }, respondWith: (p: Promise<Response>) => { response = p; }, waitUntil: (p: Promise<any>) => waits.push(p) });
    return { response, done: () => Promise.all(waits) };
  }
  return { request, caches, stored, handlers, claim, cache };
}
afterEach(() => vi.useRealTimers());
it("serves an explicit retry page for a hanging navigation, never a stale shell", async () => {
  vi.useFakeTimers();
  const w = worker(vi.fn(() => new Promise(() => {})));
  w.stored.set(origin + "/", new Response("old app shell"));
  const result = w.request("/story/1440001", "navigate");
  await vi.advanceTimersByTimeAsync(12000);
  const response = await result.response!;
  expect(response.status).toBe(503);
  expect(await response.text()).toContain("try again");
});
it("passes a healthy navigation through without caching HTML", async () => {
  const w = worker();
  expect((await w.request("/story/123", "navigate").response!).status).toBe(200);
  expect(w.cache.put).not.toHaveBeenCalled();
});
it("does not intercept API, media, private pages, POST or range requests", () => {
  const w = worker();
  for (const path of ["/api/trpc/feed.list", "/social/reel.mp4", "/admin.json", "/assets/test.js?v=1"])
    expect(w.request(path).response).toBeUndefined();
  expect(w.request("/assets/test.js", "cors", { method: "POST" }).response).toBeUndefined();
  expect(w.request("/assets/test.js", "cors", { headers: { Range: "bytes=0-20" } }).response).toBeUndefined();
});
it("still delivers scripts when CacheStorage is blocked", async () => {
  const w = worker(vi.fn().mockResolvedValue(new Response("app()", { headers: { "Content-Type": "application/javascript" } })));
  w.caches.match.mockRejectedValue(new Error("blocked"));
  w.caches.open.mockRejectedValue(new Error("blocked"));
  const result = w.request("/assets/app-123.js");
  expect(await (await result.response!).text()).toBe("app()");
  await expect(result.done()).resolves.toBeDefined();
});
it("bounds static cache growth across deployments", async () => {
  const w = worker(vi.fn(async () => new Response("app()", { headers: { "Content-Type": "application/javascript" } })));
  w.stored.set(origin + "/offline.html", new Response("offline"));
  for (let i = 0; i < 70; i++) {
    const result = w.request(`/assets/app-${i}.js`);
    await result.response;
    await result.done();
  }
  expect(w.stored.size).toBe(64);
  expect(w.stored.has(origin + "/offline.html")).toBe(true);
});
it("deletes only The Desk's old caches during activation", async () => {
  const w = worker();
  let done!: Promise<any>;
  w.handlers.activate({ waitUntil: (p: Promise<any>) => { done = p; } });
  await done;
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("thedesk-shell-v3");
  expect(w.claim).toHaveBeenCalledOnce();
});
