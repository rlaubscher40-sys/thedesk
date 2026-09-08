import { afterEach, expect, it, vi } from "vitest";
import { DeadlineError, withDeadline } from "./requestDeadline";
afterEach(() => vi.useRealTimers());

it("returns success and clears the deadline", async () => {
  vi.useFakeTimers();
  expect(await withDeadline(async () => "done", 100)).toBe("done");
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves errors and clears the deadline", async () => {
  vi.useFakeTimers();
  const error = new Error("network failure");
  await expect(withDeadline(async () => { throw error; }, 100)).rejects.toBe(error);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds an unresponsive operation and signals cancellation", async () => {
  vi.useFakeTimers();
  let signal!: AbortSignal;
  const result = withDeadline(async (value) => { signal = value; return new Promise(() => {}); }, 100);
  const rejected = expect(result).rejects.toBeInstanceOf(DeadlineError);
  await vi.advanceTimersByTimeAsync(100);
  await rejected;
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
