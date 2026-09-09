import { describe, expect, it } from "vitest";
import { balanceCountFrame, housingBalanceStoryboard } from "./housingBalanceStoryboard";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import { storyboardSections } from "./storyboard";
import { layout } from "./statReel";

describe("synchronised housing count-ups", () => {
  it.each([232000, 287000, 55000])("keeps %s and its bar on the same eased value", (target) => {
    const ticks = Array.from({ length: 31 }, (_, i) => balanceCountFrame(target, i / 30));
    expect(ticks[0]).toEqual({ value: 0, widthPercent: 0 });
    expect(ticks.at(-1)!.value).toBe(target);
    ticks.forEach((tick, i) => {
      expect(tick.value).toBeGreaterThanOrEqual(ticks[Math.max(0, i - 1)]!.value);
      expect(tick.value).toBeLessThanOrEqual(target);
      expect(tick.value % 1000).toBe(0);
      expect(tick.widthPercent).toBeCloseTo((tick.value / 300000) * 100, 10);
    });
    expect(ticks[15]!.value).toBeGreaterThan(target / 2);
  });
  it.each([-1, 1.01, NaN, Infinity])("rejects invalid progress %s", (p) => {
    expect(() => balanceCountFrame(232000, p)).toThrow();
  });
  it("allocates a bounded reveal and reading hold inside the spoken passage", () => {
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const durations = Object.fromEntries(
      story.scenes.map((s) => [
        s.key,
        s.key === "households"
          ? 3
          : s.key === "contrast"
            ? 2.7
            : s.key === "signOff"
              ? 2.3
              : s.key === "checkNeed"
                ? 1.7
                : 4,
      ])
    );
    const sections = storyboardSections(story, durations);
    for (const key of ["value", "line", "facts", "households"]) {
      const s = sections.find((s) => s.key === key)!;
      expect(s.frames[0]!.sceneProgress).toBe(0);
      expect(s.frames.at(-1)!.sceneProgress).toBe(1);
      expect(s.frames.slice(1).every((f) => f.hardCut)).toBe(true);
      expect(s.frames.reduce((sum, f) => sum + (f.seconds ?? 0), 0)).toBeLessThan(2.1);
      const beats = layout([s]).beats;
      expect(beats.slice(1).every((b) => b.fade === 0)).toBe(true);
      expect(beats.at(-1)!.seconds).toBeGreaterThan(key === "households" ? 1 : 1.5);
    }
    expect(layout(sections).total).toBeLessThan(32);
  });
  it("waits for the recorded demand phrase and reveals the hook at its recorded pause", () => {
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const durations = Object.fromEntries(story.scenes.map((s) => [s.key, 5]));
    const phrases = Object.fromEntries(
      story.scenes.map((s) => [
        s.key,
        s.phrases.map((text, i) => ({ text, start: i * 1.2, seconds: 1 })),
      ])
    );
    const sections = storyboardSections(story, durations, phrases);
    const demand = sections.find((s) => s.key === "line")!;
    expect(demand.frames[0]!.sceneProgress).toBe(0);
    expect(demand.frames[0]!.seconds).toBeCloseTo(1.2);
    const demandBeats = layout([demand]).beats;
    expect(demandBeats.slice(1).every((b) => b.fade === 0)).toBe(true);
    const hook = sections.find((s) => s.key === "label")!;
    expect(hook.frames.map((f) => f.sceneProgress)).toEqual([0, 1]);
    expect(hook.frames[0]!.seconds).toBeCloseTo(1.2);
    expect(() => storyboardSections(story, durations, {})).toThrow("measured");
  });
});
