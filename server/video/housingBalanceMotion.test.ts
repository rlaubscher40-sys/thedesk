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
      // The bar uses the underlying eased value; the label rounds to 1,000.
      expect(Math.abs(tick.widthPercent * 3000 - tick.value)).toBeLessThanOrEqual(500.00001);
    });
    expect(ticks[15]!.widthPercent).toBeCloseTo((target / 2 / 300000) * 100);
    expect(new Set(ticks.map((t) => t.widthPercent)).size).toBe(ticks.length);
  });
  it.each([-1, 1.01, NaN, Infinity])("rejects invalid progress %s", (p) => {
    expect(() => balanceCountFrame(232000, p)).toThrow();
  });
  it("allocates a bounded reveal and reading hold inside the spoken passage", () => {
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const durations = Object.fromEntries(story.scenes.map((s) => [s.key, 4]));
    const sections = storyboardSections(story, durations);
    for (const key of ["facts", "households"]) {
      const s = sections.find((s) => s.key === key)!;
      expect(s.frames[0]!.sceneProgress).toBe(0);
      expect(s.frames.at(-1)!.sceneProgress).toBe(1);
      expect(s.frames.slice(1).every((f) => f.hardCut)).toBe(true);
      expect(s.frames.reduce((sum, f) => sum + (f.seconds ?? 0), 0)).toBeLessThan(2.1);
      const beats = layout([s]).beats;
      expect(beats.slice(1).every((b) => b.fade === 0)).toBe(true);
      expect(beats.at(-1)!.seconds).toBeGreaterThan(1.5);
    }
    expect(layout(sections).total).toBeLessThan(32);
  });
  it("starts each of the three comparison phases at its measured phrase", () => {
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const durations = Object.fromEntries(story.scenes.map((s) => [s.key, 5]));
    const phrases = Object.fromEntries(
      story.scenes.map((s) => [
        s.key,
        s.phrases.map((text, i) => ({ text, start: i * 1.2, seconds: 1 })),
      ])
    );
    const sections = storyboardSections(story, durations, phrases);
    for (const key of ["facts", "households", "construction", "signOff"]) {
      const section = sections.find((s) => s.key === key)!;
      expect(section.frames[0]!.hardCut).toBe(true);
      const count = phrases[key]!.length;
      let at = 0;
      for (const frame of section.frames) {
        for (let phase = 1; phase < count; phase++) {
          if (at < phase * 1.2 - 0.001)
            expect(frame.sceneProgress).toBeLessThanOrEqual(phase / count);
          if (frame.sceneProgress! > phase / count) expect(at).toBeGreaterThanOrEqual(phase * 1.2);
        }
        expect(frame.seconds ?? 1).toBeGreaterThan(0);
        at += frame.seconds ?? 0;
      }
      expect(section.frames.at(-1)!.sceneProgress).toBe(1);
      expect(at).toBeLessThan(5);
      expect(
        layout([section])
          .beats.slice(1)
          .every((b) => b.fade === 0)
      ).toBe(true);
    }
    expect(() => storyboardSections(story, durations, {})).toThrow("measured");
    phrases.facts![2]!.start = 1.5;
    expect(() => storyboardSections(story, durations, phrases)).toThrow("measured");
  });
});
