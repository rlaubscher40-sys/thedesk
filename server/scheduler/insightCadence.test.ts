import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ claim: vi.fn() }));
vi.mock("../core/env", () => ({ env: { enableScheduler: true, scheduledApiKey: "fixture" } }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/jobRuns", () => ({ claimJobRun: m.claim, markJobRun: vi.fn() }));
vi.mock("../instagram/reelAutomation", () => ({
  runReelAutomation: async () => ({ state: "no-evidence" }),
}));
vi.mock("../instagram/reelStoryAutomation", () => ({
  runReelStoryAutomation: async () => ({ state: "no-confirmed-reel" }),
}));
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it.each([
  ["2026-09-13T21:17:00Z", null],
  ["2026-09-13T22:17:00Z", "instagram-insights"],
  ["2026-09-14T10:17:00Z", "instagram-insights-evening"],
])("collects at the intended Sydney slot %s", async (now, key) => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  m.claim.mockReset().mockResolvedValue(0);
  const { startScheduler } = await import("./index");
  startScheduler({ port: 3210 });
  await vi.advanceTimersByTimeAsync(15000);
  const calls = m.claim.mock.calls.filter((call) => call[0].startsWith("instagram-insights"));
  expect(calls.map((call) => call[0])).toEqual(key ? [key] : []);
  if (key) expect(calls[0][1]).toBe("2026-09-14");
});
