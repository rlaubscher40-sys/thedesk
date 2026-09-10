import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import {
  housingBalanceFrameLayout,
  housingBalanceStoryboard,
  housingBalanceGeometry,
  BALANCE_CHART,
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
        ["value", "line", "facts"].includes(scene.key)
          ? "JUL 2024 TO DEC 2025"
          : "HOUSING AFFORDABILITY"
      );
      expect(meta.publisher).toBe("National Housing Supply and Affordability Council");
      expect(meta.source).toContain("NHSAC 2026");
    }
    expect(copy(frame("households").content).join(" ")).toContain(
      "Adult children staying home longer."
    );
    expect(frame("households").meta.source).toContain("44");
  });
  it("retains one supply endpoint and one scale through the comparison", () => {
    expect(story.scenes.map((s) => s.key)).toEqual([
      "label",
      "value",
      "line",
      "facts",
      "claim",
      "households",
      "construction",
      "signOff",
    ]);
    expect(BALANCE_CHART.scale).toBe(300000);
    const first = housingBalanceGeometry(story, "label", 1);
    for (const key of ["line", "facts"]) {
      for (const p of [0, 0.4, 1]) {
        const g = housingBalanceGeometry(story, key, p);
        expect(g.supplyWidth).toBe(first.supplyWidth);
        expect(g.gapLeft).toBe(first.supplyWidth);
      }
    }
    expect(housingBalanceGeometry(story, "value", 0).supply).toBe(0);
    expect(housingBalanceGeometry(story, "value", 1).supply).toBe(232000);
    const final = housingBalanceGeometry(story, "facts", 1);
    expect(final.supplyWidth + final.gapWidth).toBeCloseTo(final.demandWidth);
    expect(final.gap).toBe(55000);
    expect(copy(frame("line", 0).content)).not.toContain("0 homes needed");
  });
  it("distinguishes illustrated price pressure from a price forecast", () => {
    const words = copy(frame("claim").content).join(" ");
    expect(words).toContain("Upward pressure, not guaranteed rises.");
    expect(words).toContain("borrowing power");
    expect(words).not.toMatch(/55,000|%/);
    expect(copy(frame("construction").content).join(" ")).toContain("Shortages of skilled labour");
    expect(frame("construction").meta.source).toContain("Supply constraints");
  });

  it("labels the ending as illustration and never reuses the flow gap as a stock estimate", () => {
    for (const p of [0, 1]) {
      const words = copy(frame("signOff", p).content).join(" ");
      expect(words).toContain("Supply must catch up with demand.");
      expect(words).toContain("ILLUSTRATION");
      expect(words).not.toMatch(/55,000|19 short/);
    }
  });
});
