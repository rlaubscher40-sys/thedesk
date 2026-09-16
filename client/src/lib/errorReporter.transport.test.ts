import { afterEach, beforeEach, expect, it, vi } from "vitest";
let reporter: typeof import("./errorReporter");
let fetcher: ReturnType<typeof vi.fn>;
let page: EventTarget;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
  page = new EventTarget();
  vi.stubGlobal(
    "window",
    Object.assign(page, {
      location: { href: "https://thedesk.au/ask?q=private-question#private-fragment" },
    })
  );
  fetcher = vi.fn().mockResolvedValue({ status: 204 });
  vi.stubGlobal("fetch", fetcher);
  reporter = await import("./errorReporter");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("scrubs and bounds explicit reports before transmitting them", () => {
  const err = new Error(
    "Failed https://user:password@thedesk.au/ask?q=private-question " + "x".repeat(600)
  );
  err.stack = `Error: https://thedesk.au/ask?q=private-question\n${"s".repeat(9_000)}`;
  reporter.reportError(err);
  const body = fetcher.mock.calls[0]![1].body;
  for (const secret of ["private-question", "private-fragment", "password", "user:"])
    expect(body).not.toContain(secret);
  const report = JSON.parse(body);
  expect(report.message).toHaveLength(512);
  expect(report.stack).toHaveLength(8_000);
  expect(report.url).toBe("https://thedesk.au/ask");
});
it("protects global errors and unhandled rejections and only attaches handlers once", () => {
  const listeners = vi.spyOn(page, "addEventListener");
  reporter.initErrorReporter();
  reporter.initErrorReporter();
  expect(listeners).toHaveBeenCalledTimes(2);
  page.dispatchEvent(
    Object.assign(new Event("error"), {
      message: "Page failed https://thedesk.au/?token=private-error",
      error: null,
    })
  );
  page.dispatchEvent(
    Object.assign(new Event("unhandledrejection"), {
      reason: "Fetch /api/trpc?input=private-rejection failed",
    })
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const call of fetcher.mock.calls) expect(call[1].body).not.toContain("private-");
});
it("deduplicates sanitised errors and bounds distinct-error storms before network requests", () => {
  reporter.reportError("Failed https://thedesk.au/ask?q=first");
  reporter.reportError("Failed https://thedesk.au/ask?q=second");
  expect(fetcher).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 100; i++) reporter.reportError(`Distinct error ${i}`);
  expect(fetcher).toHaveBeenCalledTimes(10);
  vi.advanceTimersByTime(60_000);
  reporter.reportError("After cooldown");
  expect(fetcher).toHaveBeenCalledTimes(11);
});
it("does not throw when transport fails or a thrown object's conversion fails", async () => {
  fetcher.mockRejectedValue(new Error("offline"));
  expect(() => reporter.reportError(new Error("original failure"))).not.toThrow();
  await Promise.resolve();
  expect(() =>
    reporter.reportError({
      toString() {
        throw new Error("conversion failed");
      },
    })
  ).not.toThrow();
});
