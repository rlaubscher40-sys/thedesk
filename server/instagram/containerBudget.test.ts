import { describe, expect, it } from "vitest";
import { containerWaitBudgetMs, MAX_CONTAINER_WAIT_MS, MIN_CONTAINER_WAIT_MS } from "./post";

const NOW = 1_000_000;

describe("containerWaitBudgetMs", () => {
  it("waits the full five minutes when nobody set a deadline", () => {
    expect(containerWaitBudgetMs(undefined, NOW)).toBe(MAX_CONTAINER_WAIT_MS);
  });

  it("gives the transcode whatever the render left behind", () => {
    // Node aborts the scheduler's fetch at 300s — measured. A flat five-minute
    // wait on top of a ninety-second render puts the response past that, and
    // the post lands while the run is recorded as failed.
    expect(containerWaitBudgetMs(NOW + 180_000, NOW)).toBe(180_000);
  });

  it("never waits longer than the ceiling, however much time is left", () => {
    expect(containerWaitBudgetMs(NOW + 900_000, NOW)).toBe(MAX_CONTAINER_WAIT_MS);
  });

  it("stops short of a wait too brief to be worth attempting", () => {
    // A four-second wait fails a transcode that was going to succeed. Better to
    // fail cleanly now and let the retry, which starts fresh, have a real go.
    expect(containerWaitBudgetMs(NOW + 4_000, NOW)).toBe(MIN_CONTAINER_WAIT_MS);
  });

  it("holds the floor even when the deadline has already gone", () => {
    expect(containerWaitBudgetMs(NOW - 60_000, NOW)).toBe(MIN_CONTAINER_WAIT_MS);
  });
});
