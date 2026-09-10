import { describe, expect, it } from "vitest";
import { rentPhrasePlan, rentCueProgress, rentComparisonLayout } from "./rentComparisonLayout";
import { verifiedRentReel } from "../instagram/verifiedReel";
import { splitMotion } from "./reelMotion";
const now = new Date("2026-09-10T12:00:00Z");
const visual = () =>
  verifiedRentReel(
    {
      status: "available",
      retrievedAt: now.toISOString(),
      observations: [
        { city: "Brisbane", period: "2026-07", annualPercent: 4.6, status: "" },
        { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "" },
      ],
    },
    now
  )!.stat.visualStory!;
describe("connected rent explanation", () => {
  it("keeps decimal figures intact and changes the second city only on its spoken cue", () => {
    const v = visual(),
      plan = rentPhrasePlan(v);
    expect(plan.find((p) => p.key === "value")!.phrases).toEqual([
      "Brisbane, 4.6 percent.",
      "Perth, 5.3 percent.",
    ]);
    expect(plan.every((p) => p.phrases.join(" ") === p.text)).toBe(true);
    const cues = [
      { text: "Brisbane", start: 0, seconds: 2 },
      { text: "Perth", start: 2.2, seconds: 2 },
    ];
    expect(rentCueProgress(2, cues, 0)).toBe(1);
    expect(rentCueProgress(2, cues, 1)).toBe(0);
    expect(rentCueProgress(4, cues, 1)).toBe(1);
  });
  it("carries completed bars into the next scene and compresses them without changing the data", () => {
    const v = visual();
    const layers = (key: string, p: number) =>
      splitMotion(rentComparisonLayout(v, key, { progress: p, rates: [1, 1] }, "navy").content)
        .layers;
    for (const id of ["fill-0", "fill-1", "number-0", "number-1", "city-0", "city-1"]) {
      const a = layers("value", 1).find((l) => l.id === id)!,
        b = layers("line", 0).find((l) => l.id === id)!,
        c = layers("claim", 0).find((l) => l.id === id)!;
      expect(b).toEqual(a);
      expect(c).toEqual(a);
      const end = layers("claim", 1).find((l) => l.id === id)!;
      expect(end.node).toEqual(a.node);
      expect(end.y).toBeLessThan(a.y);
    }
    expect(
      JSON.stringify(rentComparisonLayout(v, "claim", { progress: 1, rates: [1, 1] }, "navy"))
    ).toContain("$ ?");
  });
});
