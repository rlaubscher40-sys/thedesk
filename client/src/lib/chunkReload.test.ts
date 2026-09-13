import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hardReload, lazyWithReload } from "./chunkReload";
vi.mock("react", () => ({ lazy: (factory: unknown) => factory }));
const failure = new Error("Importing a module script failed.");
function load(factory: () => Promise<any>, key = "Feed"): Promise<any> {
  return (lazyWithReload(factory, key) as unknown as () => Promise<any>)();
}
beforeEach(() => {
  vi.useFakeTimers();
  const data = new Map();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  vi.stubGlobal("window", { location: { reload: vi.fn() } });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("allows one reload across routes, even if another route subsequently loads", async () => {
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  await load(() => Promise.resolve({ default: () => null }), "Feed");
  await expect(load(() => Promise.reject(failure), "Story")).rejects.toBe(failure);
  expect(window.location.reload).toHaveBeenCalledOnce();
});
it.each(["throws", "discards"])("does not auto-reload when storage %s writes", async (mode) => {
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => { if (mode === "throws") throw Error(); } });
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(window.location.reload).not.toHaveBeenCalled();
});
it("does not reload offline", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(window.location.reload).not.toHaveBeenCalled();
});
it("rejects a permanently stalled route download instead of leaving a spinner", async () => {
  const rejected = expect(load(() => new Promise(() => {}))).rejects.toThrow("took too long");
  await vi.advanceTimersByTimeAsync(20_000);
  await rejected;
  expect(window.location.reload).not.toHaveBeenCalled();
});
it("reloads after the cache cleanup deadline even if CacheStorage hangs", async () => {
  vi.stubGlobal("caches", { keys: () => new Promise(() => {}) });
  const result = hardReload();
  await vi.advanceTimersByTimeAsync(1500);
  await result;
  expect(window.location.reload).toHaveBeenCalledOnce();
});
