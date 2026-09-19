import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanRecoveryUrl, hardReload, lazyWithReload } from "./chunkReload";
vi.mock("react", () => ({ lazy: (factory: unknown) => factory }));
const failure = new Error("Importing a module script failed.");
function load(factory: () => Promise<any>, key = "Feed"): Promise<any> {
  return (lazyWithReload(factory, key) as unknown as () => Promise<any>)();
}
beforeEach(() => {
  vi.useFakeTimers();
  const data = new Map();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  vi.stubGlobal("window", { location: { href: "https://thedesk.au/", replace: vi.fn() }, history: { state: { reader: 1 }, replaceState: vi.fn() } });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("allows one reload across routes, even if another route subsequently loads", async () => {
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  await load(() => Promise.resolve({ default: () => null }), "Feed");
  await expect(load(() => Promise.reject(failure), "Story")).rejects.toBe(failure);
  expect(window.location.replace).toHaveBeenCalledOnce();
});
it.each(["throws", "discards"])("does not auto-reload when storage %s writes", async (mode) => {
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => { if (mode === "throws") throw Error(); } });
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(window.location.replace).not.toHaveBeenCalled();
});
it("does not reload offline", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(window.location.replace).not.toHaveBeenCalled();
});
it("rejects a permanently stalled route download instead of leaving a spinner", async () => {
  const rejected = expect(load(() => new Promise(() => {}))).rejects.toThrow("took too long");
  await vi.advanceTimersByTimeAsync(20_000);
  await rejected;
  expect(window.location.replace).not.toHaveBeenCalled();
});
it("reloads after the cache cleanup deadline even if CacheStorage hangs", async () => {
  vi.stubGlobal("caches", { keys: () => new Promise(() => {}) });
  const result = hardReload();
  await vi.advanceTimersByTimeAsync(1500);
  await result;
  expect(window.location.replace).toHaveBeenCalledOnce();
});
it("manual recovery escapes the same address even during the automatic cooldown", async () => {
  await expect(load(() => Promise.reject(failure))).rejects.toBe(failure);
  window.location.href = "https://thedesk.au/markets/sydney?q=rent&_desk_reload=old#evidence";
  await hardReload();
  const first = new URL(vi.mocked(window.location.replace).mock.calls[1][0]);
  expect(first.pathname).toBe("/markets/sydney");
  expect(first.searchParams.get("q")).toBe("rent");
  expect(first.hash).toBe("#evidence");
  expect(first.searchParams.getAll("_desk_reload")).toHaveLength(1);
  expect(first.searchParams.get("_desk_reload")).not.toBe("old");
  window.location.href = first.href;
  await vi.advanceTimersByTimeAsync(1);
  await hardReload();
  expect(vi.mocked(window.location.replace).mock.calls[2][0]).not.toBe(first.href);
  await expect(load(() => Promise.reject(failure), "Story")).rejects.toBe(failure);
  expect(window.location.replace).toHaveBeenCalledTimes(3);
});
it("clears only Desk caches and unregisters only its worker before navigating", async () => {
  const unregister = vi.fn().mockResolvedValue(true);
  const other = vi.fn();
  vi.stubGlobal("navigator", { onLine: true, serviceWorker: { getRegistrations: async () => [
    { active: { scriptURL: "https://thedesk.au/sw.js" }, unregister },
    { active: { scriptURL: "https://thedesk.au/other/sw.js" }, unregister: other },
  ] } });
  const remove = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("caches", { keys: async () => ["thedesk-static-v5", "another-app"], delete: remove });
  await hardReload();
  expect(remove).toHaveBeenCalledExactlyOnceWith("thedesk-static-v5");
  expect(unregister).toHaveBeenCalledOnce();
  expect(other).not.toHaveBeenCalled();
  expect(unregister.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(window.location.replace).mock.invocationCallOrder[0]);
});
it("still clears caches and navigates when worker teardown hangs", async () => {
  vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: () => new Promise(() => {}) } });
  const result = hardReload();
  await vi.advanceTimersByTimeAsync(1500);
  await result;
  expect(caches.keys).toHaveBeenCalledOnce();
  expect(window.location.replace).toHaveBeenCalledOnce();
});
it("manual recovery works even when storage APIs reject", async () => {
  vi.stubGlobal("caches", { keys: async () => { throw Error("denied"); } });
  vi.stubGlobal("sessionStorage", { getItem: () => { throw Error("denied"); } });
  vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: async () => { throw Error("denied"); } } });
  await hardReload();
  expect(window.location.replace).toHaveBeenCalledOnce();
});
it("removes the recovery marker without dropping filters, fragments or history state", () => {
  window.location.href = "https://thedesk.au/markets?q=rent&_desk_reload=123#evidence";
  cleanRecoveryUrl();
  expect(window.history.replaceState).toHaveBeenCalledExactlyOnceWith({ reader: 1 }, "", "https://thedesk.au/markets?q=rent#evidence");
});
it("does not rewrite normal URLs and tolerates unavailable history", () => {
  cleanRecoveryUrl();
  expect(window.history.replaceState).not.toHaveBeenCalled();
  window.location.href = "https://thedesk.au/?_desk_reload=123";
  vi.mocked(window.history.replaceState).mockImplementation(() => { throw Error("denied"); });
  expect(cleanRecoveryUrl).not.toThrow();
});
