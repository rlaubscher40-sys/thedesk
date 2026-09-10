import { describe, expect, it } from "vitest";
import { verifiedRentReel } from "../instagram/verifiedReel";
import { verifiedSydneyRentChange } from "../instagram/verifiedSydneyReels";
import { evidenceBarGeometry, validateEvidenceVisual } from "./evidenceVisual";
import { evidenceVisualLayout } from "./evidenceVisualLayout";
import { assertProductionCandidate } from "./reelProduction";
import { renderEditorialLayer, renderEditorialFrame } from "../og/instagramCards";
import { composeSections } from "./statReel";
const now = new Date("2026-09-10T12:00:00Z");
const rent = () =>
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
  )!;
describe("evidence-led repeatable visuals", () => {
  it("rejects text that would collide with the next heading", async () => {
    const node = {
      type: "div",
      props: {
        "data-reel-safe-text": true,
        "data-reel-max-height": 50,
        style: { display: "flex", width: 180, fontFamily: "Desk Editorial Sans", fontSize: 44 },
        children: "This heading cannot fit on a single line.",
      },
    };
    await expect(renderEditorialLayer(node, 200, 400)).rejects.toThrow("authored bounds");
    const v = rent().stat.visualStory!;
    for (const scene of v.script) {
      const layout = evidenceVisualLayout(v, scene.key, 1, "navy");
      await expect(
        renderEditorialFrame(layout.content, "navy", layout.meta)
      ).resolves.toBeInstanceOf(Buffer);
    }
  }, 30_000);
  it("binds visual values and narration to the source candidate", () => {
    const candidate = rent();
    expect(candidate.stat.visualStory!.rows).toEqual([
      { label: "Brisbane", value: 4.6 },
      { label: "Perth", value: 5.3 },
    ]);
    expect(() => assertProductionCandidate(candidate)).not.toThrow();
    candidate.stat.visualStory!.rows[0]!.value = 14.6;
    expect(() => validateEvidenceVisual(candidate.stat.visualStory!, candidate.script)).toThrow(
      "does not match"
    );
  });
  it("rejects script drift, changed attribution and missing reviewed visuals", () => {
    for (const edit of ["script", "source", "recipe"] as const) {
      const candidate = rent();
      if (edit === "script") candidate.script[0]!.text = "An unrelated claim.";
      if (edit === "source") candidate.stat.source = "Another source";
      if (edit === "recipe") delete candidate.stat.visualStory;
      expect(() => assertProductionCandidate(candidate)).toThrow();
    }
  });
  it("uses a shared signed scale with correct zero, ties and endpoints", () => {
    const g = evidenceBarGeometry([-2, 0, 4], 1);
    expect(g.zero).toBe(200);
    expect(g.bars).toEqual([
      { left: 0, width: 200 },
      { left: 200, width: 0 },
      { left: 200, width: 400 },
    ]);
    expect(evidenceBarGeometry([0, 0], 1).bars.every((b) => b.width === 0)).toBe(true);
    expect(evidenceBarGeometry([3, 3], 1).bars[0]).toEqual(evidenceBarGeometry([3, 3], 1).bars[1]);
    const widths = Array.from(
      { length: 31 },
      (_, i) => evidenceBarGeometry([4.6, 5.3], i / 30).bars[0]!.width
    );
    expect(new Set(widths).size).toBe(31);
  });
  it("gives each measured utterance its own scene and holds, without dissolving type", () => {
    const candidate = rent();
    const sections = composeSections(
      candidate.stat,
      Object.fromEntries(candidate.script.map((s) => [s.key, 3]))
    );
    expect(sections.map((s) => s.key)).toEqual(candidate.script.map((s) => s.key));
    expect(sections.every((s) => s.seconds >= 3.18 && s.frames[0]!.hardCut)).toBe(true);
    for (const scene of sections)
      expect(() =>
        evidenceVisualLayout(candidate.stat.visualStory!, scene.key, 0.5, "navy")
      ).not.toThrow();
  });
  it.each([
    [3.8, 3.5, "Rents still rose."],
    [0.2, -0.2, "Rents fell."],
    [-0.2, 0, "No annual change."],
  ])("distinguishes annual-rate direction for %s to %s", (previous, current, expected) => {
    const candidate = verifiedSydneyRentChange(
      {
        status: "available",
        retrievedAt: now.toISOString(),
        observations: [
          { city: "Sydney", period: "2026-06", annualPercent: previous, status: "" },
          { city: "Sydney", period: "2026-07", annualPercent: current, status: "" },
        ],
      },
      now
    )!;
    const layout = JSON.stringify(
      evidenceVisualLayout(candidate.stat.visualStory!, "claim", 1, "navy")
    );
    expect(layout).toContain(expected);
  });
});
