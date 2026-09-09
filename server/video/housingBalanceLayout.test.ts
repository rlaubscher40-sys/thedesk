import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import { housingBalanceFrameLayout, housingBalanceStoryboard } from "./housingBalanceStoryboard";
import { storyboardSections } from "./storyboard";

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

describe("quiet housing Reel layouts", () => {
  it("limits each scene to essential copy while preserving its date and attribution", () => {
    for (const scene of story.scenes) {
      const { content, meta } = housingBalanceFrameLayout(story, scene.key, 1, "navy");
      const words = copy(content).join(" ").split(/\s+/);
      expect(words.length, scene.key).toBeLessThanOrEqual(25);
      expect(meta.quiet).toBe(true);
      expect(meta.kicker).toContain("JUL 2024 TO DEC 2025");
      expect(meta.source).toContain("NHSAC 2026");
      expect(meta.source).toContain("Approximate");
      expect(copy(content).join(" ")).not.toMatch(/THE PROBLEM|GOLD:|UNFILLED:|Same country/);
    }
  });
  it("keeps the established supply row identical as demand arrives on the same scale", () => {
    const net = housingBalanceFrameLayout(story, "value", 1, "navy").content;
    const demand = housingBalanceFrameLayout(story, "line", 0.5, "navy").content;
    expect(children(net)[1]).toEqual(children(demand)[1]);
    const supplyRow = children(demand)[1]!;
    const demandRow = children(demand)[2]!.props.children as Element;
    expect(supplyRow.props.style?.width).toBe(840);
    expect(demandRow.props.style?.width).toBe(840);
    expect(children(net)[0]!.props.style?.height).toBe(children(demand)[0]!.props.style?.height);
    expect(net.props.style).toEqual(demand.props.style);
  });
  it("reserves a fixed counter width so /100 never shifts between one and two digits", () => {
    for (const progress of [0.1, 1]) {
      const frame = housingBalanceFrameLayout(story, "claim", progress, "navy").content;
      expect(children(children(frame)[0])[0]!.props.style?.width).toBe(210);
    }
  });
  it("holds static opening and closing scenes without redundant animation ticks", () => {
    const sections = storyboardSections(
      story,
      Object.fromEntries(story.scenes.map((s) => [s.key, 4]))
    );
    for (const key of ["label", "contrast", "signOff"])
      expect(sections.find((s) => s.key === key)!.frames).toHaveLength(1);
  });
});
