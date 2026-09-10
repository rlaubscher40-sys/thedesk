import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateBoots, HEALTHY_BOOT_MS, initCrashLoopGuard, LOOP_THRESHOLD, WINDOW_MS, watchHealthyBoot } from "./crashLoopDetector";
import { reportError } from "./errorReporter";
import { enableLiteMode } from "./liteMode";

vi.mock("./errorReporter", () => ({ reportError: vi.fn() }));
vi.mock("./liteMode", () => ({ enableLiteMode: vi.fn() }));

describe("evaluateBoots", () => {
  it("does not flag a loop below the threshold", () => {
    const now = 1_000_000;
    const prev = [now - 100, now - 200]; // 2 recent boots
    const { boots, looping } = evaluateBoots(prev, now);
    expect(boots).toHaveLength(3);
    expect(looping).toBe(false);
  });

  it("flags a loop when boots reach the threshold inside the window", () => {
    const now = 1_000_000;
    // (LOOP_THRESHOLD - 1) prior recent boots + this one === LOOP_THRESHOLD.
    const prev = Array.from({ length: LOOP_THRESHOLD - 1 }, (_, i) => now - (i + 1) * 100);
    const { boots, looping } = evaluateBoots(prev, now);
    expect(boots).toHaveLength(LOOP_THRESHOLD);
    expect(looping).toBe(true);
  });

  it("prunes boots older than the window so a slow trickle never accumulates", () => {
    const now = 1_000_000;
    // Plenty of boots, but all outside the window — they must drop off.
    const prev = Array.from({ length: 10 }, (_, i) => now - WINDOW_MS - i * 100);
    const { boots, looping } = evaluateBoots(prev, now);
    expect(boots).toEqual([now]);
    expect(looping).toBe(false);
  });

  it("ignores garbage future timestamps left in storage", () => {
    const now = 1_000_000;
    const prev = [now + 5_000, now - 100];
    const { boots } = evaluateBoots(prev, now);
    expect(boots).toEqual([now - 100, now]);
  });
});

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("startup lifecycle", () => {
  let tab: ReturnType<typeof storage>;
  let page: EventTarget;
  let navigation: string;
  let unregister: ReturnType<typeof vi.fn>;
  let deleteCache: ReturnType<typeof vi.fn>;
  const now = 1_000_000;

  // A new document has new event listeners but retains its tab's storage.
  function boot(at: number, tabStorage = tab) {
    page = new EventTarget();
    vi.stubGlobal("window", Object.assign(page, { location: { href: "https://thedesk.au/markets" } }));
    vi.stubGlobal("sessionStorage", tabStorage);
    return initCrashLoopGuard(at);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    tab = storage();
    navigation = "reload";
    unregister = vi.fn().mockResolvedValue(true);
    deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: navigation }] });
    vi.stubGlobal("navigator", { userAgent: "test", serviceWorker: {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
    } });
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue(["shell"]), delete: deleteCache });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("isolates rapid starts across tabs and ignores the old shared counter", () => {
    localStorage.setItem("thedesk:boots", JSON.stringify([now - 3, now - 2, now - 1]));
    const otherTab = storage();
    for (let i = 0; i < 3; i++) {
      expect(boot(now + i, tab)).toBe(false);
      expect(boot(now + i, otherTab)).toBe(false);
    }
    expect(reportError).not.toHaveBeenCalled();
    expect(enableLiteMode).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  it("does not count rapid orderly reloads as interrupted starts", () => {
    for (let i = 0; i < 10; i++) {
      expect(boot(now + i)).toBe(false);
      page.dispatchEvent(new Event("pagehide"));
    }
    expect(reportError).not.toHaveBeenCalled();
    expect(enableLiteMode).not.toHaveBeenCalled();
  });

  it.each(["navigate", "back_forward"])("resets inherited or stale trails on %s", (type) => {
    for (let i = 0; i < 3; i++) expect(boot(now + i)).toBe(false);
    navigation = type;
    expect(boot(now + 3)).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("clears the interrupted streak after a committed tree stays alive", async () => {
    for (let i = 0; i < 3; i++) expect(boot(now + i)).toBe(false);
    watchHealthyBoot();
    await vi.advanceTimersByTimeAsync(HEALTHY_BOOT_MS);
    expect(boot(now + HEALTHY_BOOT_MS)).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("retains recovery when a committed tree is interrupted before the healthy interval", async () => {
    for (let i = 0; i < 3; i++) expect(boot(now + i)).toBe(false);
    watchHealthyBoot();
    await vi.advanceTimersByTimeAsync(HEALTHY_BOOT_MS - 1);
    expect(boot(now + HEALTHY_BOOT_MS - 1)).toBe(true);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it("cancels health confirmation when the tree unmounts", async () => {
    for (let i = 0; i < 3; i++) expect(boot(now + i)).toBe(false);
    const stop = watchHealthyBoot();
    stop();
    await vi.advanceTimersByTimeAsync(HEALTHY_BOOT_MS);
    expect(boot(now + HEALTHY_BOOT_MS)).toBe(true);
  });

  it("recovers repeated interrupted starts, resets retry, and shares the cleanup cooldown", async () => {
    for (let i = 0; i < 3; i++) expect(boot(now + i)).toBe(false);
    expect(boot(now + 3)).toBe(true);
    await vi.runAllTimersAsync();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Possible startup loop") }));
    expect(enableLiteMode).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith("shell");
    expect(boot(now + 4)).toBe(false);

    const otherTab = storage();
    for (let i = 0; i < 3; i++) expect(boot(now + 5 + i, otherTab)).toBe(false);
    expect(boot(now + 8, otherTab)).toBe(true);
    await vi.runAllTimersAsync();
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledOnce();
  });

  it("fails open when tab storage is blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    for (let i = 0; i < 10; i++) expect(boot(now + i, blocked)).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
    expect(enableLiteMode).not.toHaveBeenCalled();
  });
});
