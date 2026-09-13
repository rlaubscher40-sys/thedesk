import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
function browser(coarse = false, reduced = false) {
  vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: query.includes("pointer") ? coarse : reduced }) });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  const toggle = vi.fn();
  vi.stubGlobal("document", { documentElement: { classList: { toggle } } });
  return toggle;
}
it("uses the lightweight path on touch devices from their first visit", async () => {
  const toggle = browser(true);
  const { isLiteMode, applyLiteClass } = await import("./liteMode");
  expect(isLiteMode()).toBe(true);
  applyLiteClass();
  expect(toggle).toHaveBeenCalledWith("lite", true);
});
it("retains desktop effects unless reduced motion is requested", async () => {
  browser();
  const { isLiteMode } = await import("./liteMode");
  expect(isLiteMode()).toBe(false);
  browser(false, true);
  expect(isLiteMode()).toBe(true);
});
it("keeps recovery mode enabled when storage is blocked", async () => {
  const toggle = browser();
  vi.stubGlobal("localStorage", { getItem() { throw Error(); }, setItem() { throw Error(); } });
  const { isLiteMode, enableLiteMode } = await import("./liteMode");
  enableLiteMode();
  expect(isLiteMode()).toBe(true);
  expect(toggle).toHaveBeenCalledWith("lite", true);
});
