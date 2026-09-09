import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import { housingBalanceFrameLayout, housingBalanceStoryboard } from "./housingBalanceStoryboard";

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
      expect(meta.kicker).toContain("JUL 2024 TO DEC 2025");
      expect(meta.source).toContain("NHSAC 2026");
      expect(meta.source).toContain(
        scene.key === "households" ? "Reported context" : "Approximate"
      );
    }
    expect(copy(frame("households").content).join(" ")).toContain("parental home for longer");
    expect(frame("households").meta.source).toContain("44");
  });
  it("retains one supply row and one scale through the comparison", () => {
    const net = frame("value").content,
      demand = frame("line", 0.5).content;
    const gap = frame("facts").content;
    expect(children(net)[1]).toEqual(children(demand)[1]);
    expect(children(net)[1]).toEqual(children(gap)[1]);
    expect(children(net)[0]!.props.style?.height).toBe(children(demand)[0]!.props.style?.height);
    const needRow = children(children(gap)[2])[0]!;
    const bar = children(needRow)[1]!;
    expect(bar.props.style?.width).toBe(840);
    const marker = children(bar)[1]!,
      shortfall = children(bar)[2]!;
    expect(marker.props.style?.left).toBeCloseTo((232000 / 300000) * 840);
    expect(shortfall.props.style?.left).toBe(marker.props.style?.left);
    expect(shortfall.props.style?.width).toBeCloseTo((55000 / 300000) * 840);
    expect(copy(children(frame("line", 0).content)[2])).not.toContain("0");
  });
  it("shows the rounded 81/100 ratio without suggesting 100 observed households", () => {
    const grid = children(frame("claim").content)[2]!;
    const cells = children(grid).flatMap(children);
    expect(cells).toHaveLength(100);
    expect(cells.filter((c) => c.props.style?.backgroundColor === "#C5A267")).toHaveLength(81);
    expect(copy(frame("claim").content)).toContain("Approximate ratio, over these 18 months.");
  });
  it("labels the ending as illustration and never reuses the flow gap as a stock estimate", () => {
    for (const p of [0, 1]) {
      const words = copy(frame("signOff", p).content).join(" ");
      expect(words).toContain("Homes added must outpace extra homes needed.");
      expect(words).toContain("Illustration");
      expect(words).not.toMatch(/55,000|19 short/);
    }
  });
});
