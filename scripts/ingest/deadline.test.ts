import { afterEach, expect, it, vi } from "vitest";
import { collectionDeadline } from "./lib/deadline";
afterEach(() => vi.useRealTimers());
it("lets a stalled read expire so successful sources can be stored", async () => {
  vi.useFakeTimers();
  const collection = collectionDeadline(new Promise<string[]>(() => {}), [], 45_000);
  await vi.advanceTimersByTimeAsync(45_000);
  expect(await collection).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});
it("preserves a source that completes within the collection window", async () => {
  vi.useFakeTimers();
  expect(await collectionDeadline(Promise.resolve(["observed"]), [], 45_000)).toEqual(["observed"]);
  expect(vi.getTimerCount()).toBe(0);
});
