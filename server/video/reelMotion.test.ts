import { describe, expect, it } from "vitest";
import { smooth, phraseMotion, moving, splitMotion } from "./reelMotion";
import { housingCamera } from "./housingMotionRenderer";
import {
  housingBalanceStoryboard,
  housingBalanceGeometry,
  housingDepositGeometry,
} from "./housingBalanceStoryboard";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";

describe("continuous editorial movement", () => {
  it("accelerates and settles without overshooting or quantising geometry", () => {
    const p = Array.from({ length: 91 }, (_, i) => smooth(i / 90));
    expect(p[0]).toBe(0);
    expect(p.at(-1)).toBe(1);
    expect(new Set(p).size).toBe(91);
    expect(p[1]! - p[0]!).toBeLessThan(p[45]! - p[44]!);
    expect(p[90]! - p[89]!).toBeLessThan(p[45]! - p[44]!);
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const bars = p.map((_, i) => housingBalanceGeometry(story, "facts", i / 90 / 3).supplyWidth);
    const markers = p.map((_, i) => housingDepositGeometry(0.5 + i / 180).dotX);
    expect(new Set(bars).size).toBe(91);
    expect(new Set(markers).size).toBe(91);
  });
  it("waits for each measured phrase and holds its result before the next", () => {
    const cues = [0, 2, 4].map((start) => ({ text: "Example.", start, seconds: 1.5 }));
    expect(phraseMotion(1.5, cues, 5.5)).toBe(1 / 3);
    expect(phraseMotion(1.99, cues, 5.5)).toBe(1 / 3);
    expect(phraseMotion(2, cues, 5.5)).toBe(1 / 3);
    expect(phraseMotion(2 + 1 / 30, cues, 5.5)).toBeGreaterThan(1 / 3);
    expect(phraseMotion(5.3, cues, 5.5)).toBe(1);
  });
  it("carries the camera across the scene boundary without resetting position", () => {
    const scenes = ["label", "facts", "claim", "households", "construction", "signOff"].map(
      (key, i) => ({ key, start: i * 5, seconds: 5, phrases: [] })
    );
    const before = housingCamera("construction", 25, scenes, 30);
    const after = housingCamera("signOff", 25, scenes, 30);
    expect(before).toEqual(after);
    expect(housingCamera("signOff", 25 + 1 / 30, scenes, 30).height).toBeGreaterThan(after.height);
  });
  it("keeps moving elements out of the stationary plate and inherits offsets and opacity", () => {
    const child = moving("number", {
      type: "div",
      props: { style: { left: 4, top: 9, opacity: 0.5 }, children: "232,000" },
    });
    const split = splitMotion({
      type: "div",
      props: { style: { left: 20, top: 40, opacity: 0.6 }, children: [child, "Source"] },
    });
    expect(split.staticTree.props.children).toEqual(["Source"]);
    expect(split.layers[0]).toMatchObject({ x: 24, y: 49, opacity: 0.3 });
    expect(split.layers[0]!.node.props.style).toMatchObject({ left: 0, top: 0, opacity: 1 });
  });
  it("preserves native photo proportions and full-frame coverage for different source dimensions", () => {
    const scenes = ["label", "facts", "claim", "households", "construction", "signOff"].map(
      (key, i) => ({ key, start: i * 5, seconds: 5, phrases: [] })
    );
    for (const image of [
      { width: 1400, height: 1050 },
      { width: 1400, height: 786 },
      { width: 900, height: 1400 },
    ]) {
      for (const time of [0, 2.5, 4.99, 20, 25, 29.99]) {
        const key = time < 5 ? "label" : time < 25 ? "construction" : "signOff";
        const c = housingCamera(key, time, scenes, 30, image, 0.54);
        expect(c.width / c.height).toBeCloseTo(image.width / image.height, 10);
        expect(c.left).toBeLessThanOrEqual(0);
        expect(c.top).toBeLessThanOrEqual(0);
        expect(c.left + c.width).toBeGreaterThanOrEqual(1080);
        expect(c.top + c.height).toBeGreaterThanOrEqual(1920);
      }
      expect(housingCamera("construction", 25, scenes, 30, image, 0.54)).toEqual(
        housingCamera("signOff", 25, scenes, 30, image, 0.54)
      );
    }
  });
});
