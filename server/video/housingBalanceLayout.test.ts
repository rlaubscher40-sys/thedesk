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
      expect(words.length, scene.key).toBeLessThanOrEqual(scene.key === "contrast" ? 30 : 25);
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
  it("subtracts demolitions from completions and retains the supply endpoint through the gap", () => {
    const first = housingBalanceFrameLayout(story, "value", 0, "navy").content;
    const last = housingBalanceFrameLayout(story, "value", 1, "navy").content;
    expect(copy(children(first)[1])).toContain("263,000");
    expect(copy(children(last)[1])).toContain("232,000");
    expect(copy(last)).toContain("~31,000 demolished*");
    const gap = housingBalanceFrameLayout(story, "facts", 1, "navy").content;
    expect(children(gap)[1]).toEqual(children(last)[1]);
    const demand = children(gap)[2]!.props.children as Element;
    const bar = children(demand)[2]!;
    const shortfall = children(bar)[1]!;
    expect(parseFloat(String(shortfall.props.style?.left))).toBeCloseTo((232000 / 300000) * 100);
    expect(parseFloat(String(shortfall.props.style?.width))).toBeCloseTo((55000 / 300000) * 100);
  });
  it("highlights exactly 19 missing homes together after 81 have appeared", () => {
    const grid = (p: number) =>
      children(housingBalanceFrameLayout(story, "claim", p, "navy").content)[2]!;
    const cells = (p: number) => children(grid(p)).flatMap(children);
    expect(cells(1)).toHaveLength(100);
    const colour = (cell: Element) =>
      Buffer.from(
        String((cell.props.children as { props: { src: string } }).props.src).split(",")[1]!,
        "base64"
      ).toString();
    expect(cells(1).filter((c) => colour(c).includes("#D4A853"))).toHaveLength(81);
    expect(cells(1).filter((c) => colour(c).includes("#E89576"))).toHaveLength(19);
    expect(cells(0.99).filter((c) => colour(c).includes("#E89576"))).toHaveLength(0);
  });
  it("reserves a fixed counter width so /100 never shifts between one and two digits", () => {
    for (const progress of [0.1, 1]) {
      const frame = housingBalanceFrameLayout(story, "claim", progress, "navy").content;
      expect(children(children(frame)[0])[0]!.props.style?.width).toBe(210);
    }
  });
  it("retains the completed 81/19 comparison through the explanation and takeaway", () => {
    const ratio = housingBalanceFrameLayout(story, "claim", 1, "navy").content;
    for (const key of ["signOff", "checkNeed"]) {
      const ending = housingBalanceFrameLayout(story, key, 1, "navy").content;
      expect(children(ending)[2]).toEqual(children(ratio)[2]);
      expect(children(ending)[0]!.props.style?.height).toBe(165);
      expect(ending.props.style).toEqual(ratio.props.style);
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
