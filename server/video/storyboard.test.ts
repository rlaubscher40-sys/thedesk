import { describe, expect, it } from "vitest";
import { approvalStoryboard, spokenCount, validateStoryboard } from "./storyboard";
import { composeSections, layout } from "./statReel";
import { subtitleAss, subtitleCues } from "./subtitles";

describe("spoken approval scenes", () => {
  it("preserves exact counts in speech, including zero and the supported boundaries", () => {
    expect(spokenCount(27628)).toBe("twenty-seven thousand, six hundred and twenty-eight");
    expect(spokenCount(22229)).toBe("twenty-two thousand, two hundred and twenty-nine");
    expect(spokenCount(0)).toBe("zero");
    expect(spokenCount(10001)).toBe("ten thousand and one");
    expect(spokenCount(999999)).toBe(
      "nine hundred and ninety-nine thousand, nine hundred and ninety-nine"
    );
    for (const n of [-1, 1.5, NaN, Infinity, 1000000]) expect(() => spokenCount(n)).toThrow();
  });
  it("rejects reordered, missing or edited narration and altered scene evidence", () => {
    const story = approvalStoryboard(27628, 22229, "July 2026");
    const script = story.scenes.map(({ key, text }) => ({ key, text }));
    expect(() => validateStoryboard(story, script)).not.toThrow();
    expect(() => validateStoryboard(story, [...script].reverse())).toThrow("do not match");
    expect(() => validateStoryboard(story, script.slice(1))).toThrow("do not match");
    expect(() => validateStoryboard({ ...story, perth: 1 }, script)).toThrow("do not match");
  });
  it("keeps the comparison and supply-demand explanation with measured speech", () => {
    const storyboard = approvalStoryboard(27628, 22229, "July 2026");
    const script = storyboard.scenes.map(({ key, text }) => ({ key, text }));
    const durations = Object.fromEntries(script.map((s, i) => [s.key, 1.8 + i / 10]));
    const stat = { label: "Approvals", value: "27,628", line: "", subtext: "", storyboard };
    const sections = composeSections(stat, durations);
    const timing = layout(sections);
    expect(sections.map((s) => s.key)).toEqual(script.map((s) => s.key));
    for (let i = 0; i < sections.length; i++) {
      expect(sections[i]!.frames.every((f) => f.sceneKey === script[i]!.key)).toBe(true);
      if (i < sections.length - 1)
        expect(timing.starts[i + 1]! - timing.starts[i]!).toBeGreaterThanOrEqual(
          durations[script[i]!.key]!
        );
    }
    const cues = subtitleCues(
      script,
      sections.map((s, i) => ({ key: s.key, start: timing.starts[i]!, seconds: durations[s.key]! }))
    );
    expect(cues.flatMap((c) => c.lines).join(" ")).toBe(script.map((s) => s.text).join(" "));
    expect(subtitleAss(cues, "story")).toContain("\\pos(504,1575)");
    expect(storyboard.scenes.find((s) => s.key === "value")!.showPerth).toBe(true);
    expect(storyboard.scenes.find((s) => s.key === "claim")!.kind).toBe("demand");
  });
});
