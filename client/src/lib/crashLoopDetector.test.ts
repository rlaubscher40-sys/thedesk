import { describe, expect, it } from "vitest";
import { evaluateBoots, LOOP_THRESHOLD, WINDOW_MS } from "./crashLoopDetector";

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
