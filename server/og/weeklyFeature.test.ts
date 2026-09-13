import { describe, expect, it } from "vitest";
import type { Edition } from "../db/schema";
import {
  weeklyFeatureContent,
  weeklyFeatureTree,
  weeklyTopicTree,
  weeklyRoundupTree,
} from "./weeklyFeature";

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
    expect(copy.period).toBe("7, 13 September 2026");
    expect(copy.detail).toBe(input.topics[0]!.summary);
    const tree = JSON.stringify(weeklyFeatureTree(input, theme, false, null));
    expect(tree).toContain(copy.title);
    expect(tree).toContain("PROPERTY THIS WEEK · 7, 13 September 2026");
    expect(tree).toContain("Edition 12");
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
      expect(text).not.toMatch(/Before|BEFORE|Feed date|THE WEEK.S LEAD/);
      expect(text).toContain(vertical ? "Tap for the lead story" : "Swipe to read");
    }
  });
  it("reduces type size instead of deleting a trailing geography or timeframe", () => {
    const title =
      "Dwelling approvals rose during the latest reporting period across the capital city, while completions remain a separate measure — Greater Sydney, July 2026";
    expect(weeklyFeatureContent(edition(title)).title).toBe(title.replace("—", ","));
    expect(weeklyFeatureContent(edition(title)).titleSize).toBeLessThan(
      weeklyFeatureContent(edition("Sydney approvals")).titleSize
    );
  });
  it("fails visibly for empty or unlayoutable claims rather than hiding qualifiers", () => {
    expect(() => weeklyFeatureContent({ ...edition(), topics: [] })).toThrow(/lead topic/);
    expect(() => weeklyFeatureContent(edition("x".repeat(201)))).toThrow(/editorial review/);
  });
});

it("does not reuse cached advice or invented implications in any weekly frame", () => {
  const input = edition();
  input.topics[0]!.whyItMatters = "Before acting, buy Perth now";
  input.topics[0]!.keyTakeaway = "Prices will double";
  const frames = [
    weeklyFeatureTree(input, theme, false, null),
    weeklyTopicTree(input.topics[0]!, 1, 2, theme),
    weeklyRoundupTree(input, theme),
  ];
  expect(JSON.stringify(frames)).not.toMatch(/Before|Perth|double/);
  expect(JSON.stringify(frames)).toContain(input.topics[0]!.summary);
});
it("holds missing detail and never splits a number at a sentence boundary", () => {
  const input = edition("Value of dwellings falls 0.3%");
  input.topics[0]!.summary =
    "Australian dwelling values fell 0.3% in the June quarter. The total measures all dwellings.";
  expect(weeklyFeatureContent(input).detail).toBe(
    "Australian dwelling values fell 0.3% in the June quarter."
  );
  input.topics[0]!.summary = "";
  expect(() => weeklyFeatureContent(input)).toThrow(/source detail/);
});
