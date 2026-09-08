import { describe, expect, it } from "vitest";
import type { Edition } from "../db/schema";
import { weeklyFeatureContent, weeklyFeatureTree } from "./weeklyFeature";

const edition = (title = "Sydney dwelling approvals: check what the annual total measures") =>
  ({
    editionNumber: 12,
    weekOf: "2026-09-07",
    weekRange: "7–13 September 2026",
    topics: [{ title, summary: "Dwelling approvals do not measure completed homes." }],
    rubensTake: "Never use this as the cover claim",
    keyMetrics: { asx200: "9000" },
  }) as Edition;
const theme = {
  bg: "#faf7f2",
  fg: "#0b1220",
  fgMuted: "#555555",
  amber: "#aa7722",
  amberSoft: "#ffeecc",
  bloom: "none",
};
describe("weekly finding-led design", () => {
  it("uses the full source title and edition period instead of a contents list or unrelated market strip", () => {
    const input = edition();
    const copy = weeklyFeatureContent(input);
    expect(copy.title).toBe(input.topics[0]!.title);
    expect(copy.period).toBe("7–13 September 2026");
    expect(copy.question).toContain("approvals, starts or completions");
    const tree = JSON.stringify(weeklyFeatureTree(input, theme, false, null));
    expect(tree).toContain(copy.title);
    expect(tree).toContain("Edition week: 7–13 September 2026");
    expect(tree).toContain("thedesk.au / Editions / 12");
    expect(tree).not.toMatch(/This Week|9000|Never use this|Ruben/);
  });
  it("keeps the same finding, meaning and palette across feed and Story formats", () => {
    for (const vertical of [false, true]) {
      const tree = weeklyFeatureTree(edition(), theme, vertical, null);
      expect(tree.props.style).toMatchObject({
        width: 1080,
        height: vertical ? 1920 : 1350,
        backgroundColor: theme.bg,
      });
      const text = JSON.stringify(tree);
      expect(text).toContain("Before counting new homes");
      expect(text).toContain("BEFORE YOU ACT");
      expect(text).toContain(
        vertical ? "Read the full briefing" : "Swipe for the property stories"
      );
    }
  });
  it("reduces type size instead of deleting a trailing geography or timeframe", () => {
    const title =
      "Dwelling approvals rose during the latest reporting period across the capital city, while completions remain a separate measure — Greater Sydney, July 2026";
    expect(weeklyFeatureContent(edition(title)).title).toBe(title);
    expect(weeklyFeatureContent(edition(title)).titleSize).toBeLessThan(
      weeklyFeatureContent(edition("Sydney approvals")).titleSize
    );
  });
  it("fails visibly for empty or unlayoutable claims rather than hiding qualifiers", () => {
    expect(() => weeklyFeatureContent({ ...edition(), topics: [] })).toThrow(/lead topic/);
    expect(() => weeklyFeatureContent(edition("x".repeat(201)))).toThrow(/editorial review/);
  });
});
