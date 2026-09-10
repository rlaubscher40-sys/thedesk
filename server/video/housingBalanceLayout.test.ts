import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import {
  housingBalanceFrameLayout,
  housingBalanceStoryboard,
  housingBalanceGeometry,
  BALANCE_CHART,
  housingStoryBridge,
} from "./housingBalanceStoryboard";

type Element = { type: string; props: { children?: unknown; style?: Record<string, unknown> } };
function copy(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(copy);
  if (value && typeof value === "object" && "props" in value)
    return copy((value as Element).props.children);
  return [];
}
const children = (n: unknown) => (n as Element).props.children as Element[];
const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
const frame = (key: string, p = 1) => housingBalanceFrameLayout(story, key, p, "navy");

describe("documentary housing Reel", () => {
  it("preserves date, attribution and a bounded amount of editorial copy", () => {
    for (const scene of story.scenes) {
      const { content, meta } = frame(scene.key);
      expect(copy(content).join(" ").split(/\s+/).length, scene.key).toBeLessThanOrEqual(48);
      expect(meta.quiet).toBe(true);
      expect(meta.documentary).toBe(true);
      expect(meta.kicker).toContain(
        scene.key === "facts"
          ? "JUL 2024 TO DEC 2025"
          : scene.key === "households"
            ? "2015 TO 2025"
            : "HOUSING AFFORDABILITY"
      );
      expect(meta.publisher).toBe("National Housing Supply and Affordability Council");
      expect(meta.source).toContain("NHSAC 2026");
    }
    expect(copy(frame("households").content).join(" ")).toContain("To save a modelled 20% deposit");
    expect(frame("households").meta.source).toContain("54, 57");
  });
  it("develops supply, need and their difference on one consistent scale", () => {
    expect(story.scenes.map((s) => s.key)).toEqual([
      "label",
      "facts",
      "claim",
      "households",
      "construction",
      "signOff",
    ]);
    expect(BALANCE_CHART.scale).toBe(300000);
    const first = housingBalanceGeometry(story, "facts", 0);
    expect(first.supply).toBe(0);
    expect(first.demand).toBe(0);
    const supply = housingBalanceGeometry(story, "facts", 1 / 3);
    expect(supply.supply).toBe(232000);
    expect(supply.demand).toBe(0);
    const demand = housingBalanceGeometry(story, "facts", 2 / 3);
    expect(demand.demand).toBe(287000);
    expect(demand.gap).toBe(0);
    const final = housingBalanceGeometry(story, "facts", 1);
    expect(final.supplyWidth + final.gapWidth).toBeCloseTo(final.demandWidth);
    expect(final.gap).toBe(55000);
    expect(final.gapLeft).toBe(supply.supplyWidth);
  });
  it("preserves the gold marker at both scene boundaries and scales the deposit extension", () => {
    expect(housingStoryBridge("competition", 0)).toEqual(housingStoryBridge("gap", 1));
    expect(housingStoryBridge("deposit", 0)).toEqual(housingStoryBridge("competition", 1));
    expect(housingStoryBridge("deposit", 0.5).width).toBe(0);
    expect(housingStoryBridge("deposit", 1).width).toBeCloseTo((11.2 - 9) * 70);
  });
  it("distinguishes illustrated price pressure from a price forecast", () => {
    const words = copy(frame("claim").content).join(" ");
    expect(words).toContain("Pressure, not guaranteed price rises.");
    expect(words).toContain("RATES AND INCOMES ALSO MATTER");
    expect(words).not.toMatch(/55,000|%/);
    expect(copy(frame("construction").content).join(" ")).toContain("Shortages of skilled labour");
    expect(frame("construction").meta.source).toContain("Housing supply");
  });

  it("keeps the 2015 value labelled 2015 until the 2025 phrase begins", () => {
    const before = copy(frame("households", 0.49).content).join(" ");
    expect(before).toContain("2015");
    expect(before).not.toContain("2025");
    const after = copy(frame("households", 1).content).join(" ");
    for (const label of ["2015", "2025", "9.0", "11.2"]) expect(after).toContain(label);
  });
  it("does not overlay outgoing and incoming headings during visual bridges", () => {
    for (const progress of [0, 0.08, 0.15, 0.5, 1]) {
      const pressure = copy(frame("claim", progress).content).join(" ");
      expect(pressure).toContain("Too few homes.");
      expect(pressure).not.toContain("Falling behind.");
      const deposit = copy(frame("households", progress).content).join(" ");
      expect(deposit).toContain("The deposit");
      expect(deposit).not.toContain("More competition.");
    }
  });
  it("identifies archive imagery and the modelled deposit assumptions", () => {
    const opening = copy(frame("label").content).join(" ");
    expect(opening).toContain("ILLUSTRATIVE PHOTO");
    expect(opening).toContain("Phillip Flores / Unsplash");
    const construction = copy(frame("construction").content).join(" ");
    expect(construction).toContain("ARCHIVE PUBLISHED 2019");
    expect(construction).toContain("DAMON HALL");
    const words = copy(frame("households").content).join(" ");
    for (const phrase of [
      "11.2",
      "9.0",
      "15% of gross median household income",
      "NOT AN OBSERVED WAIT",
    ])
      expect(words).toContain(phrase);
  });
  it("labels the ending as illustration and never reuses the flow gap as a stock estimate", () => {
    for (const p of [0, 1]) {
      const words = copy(frame("signOff", p).content).join(" ");
      expect(words).toContain("Add homes faster than need grows.");
      expect(words).toContain("ILLUSTRATION");
      expect(words).not.toMatch(/55,000|19 short/);
    }
  });
});
