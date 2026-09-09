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
        scene.key === "households" ? "REPORTED CONTEXT" : "JUL 2024 TO DEC 2025"
      );
      expect(meta.publisher).toBe("National Housing Supply and Affordability Council");
      expect(meta.source).toContain("NHSAC 2026");
      expect(meta.source).toContain(
        scene.key === "households" ? "Reported context" : "Approximate"
      );
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
      "signOff",
    ]);
    expect(BALANCE_CHART.scale).toBe(300000);
    const first = housingBalanceGeometry(story, "label", 1);
    for (const key of ["value", "line", "facts"]) {
      for (const p of [0, 0.4, 1]) {
        const g = housingBalanceGeometry(story, key, p);
        expect(g.supplyWidth).toBe(first.supplyWidth);
        expect(g.gapLeft).toBe(first.supplyWidth);
      }
    }
    const final = housingBalanceGeometry(story, "facts", 1);
    expect(final.supplyWidth + final.gapWidth).toBeCloseTo(final.demandWidth);
    expect(final.gap).toBe(55000);
    expect(copy(frame("line", 0).content)).not.toContain("0 homes needed");
  });
  it("shows the rounded 81/100 ratio without suggesting 100 observed households", () => {
    const root = frame("claim").content;
    function elements(n: unknown): Element[] {
      if (Array.isArray(n)) return n.flatMap(elements);
      if (!n || typeof n !== "object" || !("props" in n)) return [];
      return [n as Element, ...elements((n as Element).props.children)];
    }
    const cells = elements(root).filter((n) => n.props.style?.borderRadius === 11);
    expect(cells).toHaveLength(100);
    expect(cells.filter((c) => c.props.style?.backgroundColor === "#C5A267")).toHaveLength(81);
    expect(copy(root)).toContain("Approximate ratio, not a count of households.");
  });

  it("labels the ending as illustration and never reuses the flow gap as a stock estimate", () => {
    for (const p of [0, 1]) {
      const words = copy(frame("signOff", p).content).join(" ");
      expect(words).toContain("Add homes faster than new need grows.");
      expect(words).toContain("ILLUSTRATION");
      expect(words).not.toMatch(/55,000|19 short/);
    }
  });
});
