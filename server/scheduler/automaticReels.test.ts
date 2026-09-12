import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ run: vi.fn(), claim: vi.fn(), story: vi.fn() }));
vi.mock("../instagram/reelStoryAutomation", () => ({ runReelStoryAutomation: m.story }));
vi.mock("../core/env", () => ({
  env: { enableScheduler: true, scheduledApiKey: "scheduler-test" },
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("../db/jobRuns", () => ({ claimJobRun: m.claim, markJobRun: vi.fn() }));
vi.mock("../instagram/reelAutomation", () => ({ runReelAutomation: m.run, REEL_MAX_ATTEMPTS: 2 }));
import { startScheduler } from "./index";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("checks automatic Reels after boot and every five minutes even outside old windows", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T02:00:00Z")); // Wednesday noon Sydney.
  m.claim.mockResolvedValue(0);
  m.run.mockResolvedValue({ state: "no-evidence" });
  m.story.mockResolvedValue({ state: "no-confirmed-reel" });
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true, skipped: true })));
  vi.stubGlobal("fetch", fetch);
  startScheduler({ port: 3210 });
  await vi.advanceTimersByTimeAsync(15_000);
  expect(m.run).toHaveBeenCalledTimes(1);
  await m.run.mock.calls[0]![0].post("server-evidence-hash");
  expect(fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:3210/api/ingest/instagram-reel",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ evidenceHash: "server-evidence-hash" }),
      headers: { "content-type": "application/json", "x-scheduled-key": "scheduler-test" },
    })
  );
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  expect(m.run).toHaveBeenCalledTimes(2);
  expect(m.story).toHaveBeenCalledTimes(2);
  expect(m.run.mock.invocationCallOrder[0]).toBeLessThan(m.story.mock.invocationCallOrder[0]!);
  expect(m.claim).not.toHaveBeenCalledWith("instagram-reel", expect.anything(), expect.anything());
  vi.clearAllTimers();
});
