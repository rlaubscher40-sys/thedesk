import { expect, it, vi } from "vitest";
import { createFeedCache } from "./feedCache";

it("shares overlapping requests and expires reuse after five minutes", async () => {
  let now = 1_000;
  let finish!: (value: string) => void;
  const load = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const read = createFeedCache(load, { now: () => now });
  const first = read("feed");
  const second = read("feed");
  expect(load).toHaveBeenCalledTimes(1);
  finish("first edition");
  expect(await first).toEqual(await second);
  now += 60_000;
  expect(await read("feed")).toEqual({
    value: "first edition",
    checkedAt: 1_000,
  });
  now = 301_000;
  load.mockResolvedValueOnce("updated edition");
  expect(await read("feed")).toEqual({
    value: "updated edition",
    checkedAt: now,
  });
  expect(load).toHaveBeenCalledTimes(2);
});

it("never serves expired data when a fresh request fails and permits a later retry", async () => {
  let now = 0;
  const load = vi
    .fn()
    .mockResolvedValueOnce("old")
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce("new");
  const read = createFeedCache(load, { now: () => now });
  await read("feed");
  now = 300_000;
  await expect(read("feed")).rejects.toThrow("unavailable");
  expect((await read("feed")).value).toBe("new");
});

it("bounds entries with least-recently-used eviction", async () => {
  const load = vi.fn(async (url: string) => url);
  const read = createFeedCache(load, { maxEntries: 2 });
  await read("a");
  await read("b");
  await read("a");
  await read("c");
  expect(load).toHaveBeenCalledTimes(3);
  await read("b");
  expect(load).toHaveBeenCalledTimes(4);
});

it("bounds retained payload bytes and does not cache oversized feeds", async () => {
  const load = vi.fn(async (url: string) =>
    url === "large" ? "x".repeat(20) : "1234",
  );
  const read = createFeedCache(load, { maxBytes: 10 });
  await read("a");
  await read("b");
  await read("a");
  expect(load).toHaveBeenCalledTimes(3); // two six-byte JSON strings cannot both fit
  await read("large");
  await read("large");
  expect(load).toHaveBeenCalledTimes(5);
});

it("invalidates entries if the process clock moves backwards", async () => {
  let now = 10_000;
  const load = vi.fn(async () => "feed");
  const read = createFeedCache(load, { now: () => now });
  await read("a");
  now = 5_000;
  await read("a");
  expect(load).toHaveBeenCalledTimes(2);
});
