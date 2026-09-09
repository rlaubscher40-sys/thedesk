import { afterEach, expect, it, vi } from "vitest";
vi.mock("./client", () => ({ getDb: () => ({}) }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import {
  collectionRetryDelay,
  isCollectionJob,
  runCollectionAttempt,
  withCollectionWrite,
} from "./collectionRuns";
afterEach(() => vi.useRealTimers());

it("limits expiring locks to the exact repeatable collection jobs", () => {
  for (const key of [
    "daily-metrics",
    "official-metrics-12",
    "official-metrics-recovery-20",
    "property-evidence-23",
  ])
    expect(isCollectionJob(key)).toBe(true);
  for (const key of [
    "daily-feed",
    "weekly-edition",
    "instagram-daily",
    "instagram-reel",
    "official-metrics-recovery",
    "property-evidence-24",
    "official-metrics-13",
  ])
    expect(isCollectionJob(key)).toBe(false);
  expect([1, 2, 3, 10].map(collectionRetryDelay)).toEqual(
    [15, 30, 60, 60].map((m) => m * 60_000),
  );
});

it("times out a hung collector and blocks its late writes", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  let late!: Promise<void>;
  const write = vi.fn(async () => {});
  const run = runCollectionAttempt(
    { jobKey: "daily-metrics", runDate: "2026-09-09", attempt: 1 },
    () => {
      late = (async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await withCollectionWrite(write);
      })();
      return late;
    },
    1000,
  );
  const timedOut = expect(run).rejects.toThrow("time limit");
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  release();
  await expect(late).rejects.toThrow("time limit");
  expect(write).not.toHaveBeenCalled();
});

it("does not allow detached writes after a successful collector has ended", async () => {
  let release!: () => void;
  let late!: Promise<void>;
  const write = vi.fn(async () => {});
  await runCollectionAttempt(
    { jobKey: "daily-metrics", runDate: "2026-09-09", attempt: 1 },
    async () => {
      late = (async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await withCollectionWrite(write);
      })();
    },
  );
  release();
  await expect(late).rejects.toThrow("attempt ended");
  expect(write).not.toHaveBeenCalled();
});
