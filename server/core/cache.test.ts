import { describe, expect, it, vi } from "vitest";
import { cached, cacheKey, invalidate } from "./cache";

describe("cached", () => {
  it("returns the loader result and serves it from cache within the TTL", async () => {
    const key = cacheKey("t:hit", Math.random());
    const loader = vi.fn(async () => 42);
    expect(await cached(key, 1000, loader)).toBe(42);
    expect(await cached(key, 1000, loader)).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("re-runs the loader once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    try {
      const key = cacheKey("t:ttl", Math.random());
      const loader = vi.fn(async () => Math.random());
      const first = await cached(key, 1000, loader);
      vi.advanceTimersByTime(1001);
      const second = await cached(key, 1000, loader);
      expect(loader).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent misses into a single loader call", async () => {
    const key = cacheKey("t:herd", Math.random());
    let resolve!: (v: number) => void;
    const loader = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = cached(key, 1000, loader);
    const b = cached(key, 1000, loader);
    resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejected loader", async () => {
    const key = cacheKey("t:reject", Math.random());
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(cached(key, 1000, loader)).rejects.toThrow("boom");
    expect(await cached(key, 1000, loader)).toBe("ok");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("invalidate(prefix) drops only the matching namespace", async () => {
    const feed = cacheKey("ns:feed:a");
    const edition = cacheKey("ns:edition:a");
    const feedLoader = vi.fn(async () => "feed");
    const editionLoader = vi.fn(async () => "edition");
    await cached(feed, 10_000, feedLoader);
    await cached(edition, 10_000, editionLoader);

    invalidate("ns:feed:");
    await cached(feed, 10_000, feedLoader);
    await cached(edition, 10_000, editionLoader);

    expect(feedLoader).toHaveBeenCalledTimes(2); // re-run after invalidation
    expect(editionLoader).toHaveBeenCalledTimes(1); // untouched
  });
});

describe("cacheKey", () => {
  it("is stable for equal inputs and distinct for different ones", () => {
    expect(cacheKey("n", { a: 1 })).toBe(cacheKey("n", { a: 1 }));
    expect(cacheKey("n", { a: 1 })).not.toBe(cacheKey("n", { a: 2 }));
    expect(cacheKey("n")).toBe("n");
  });
});
