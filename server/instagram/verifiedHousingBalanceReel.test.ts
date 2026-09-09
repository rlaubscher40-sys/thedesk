import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT, matchedHousingBalance } from "../../shared/housingBalance";
import { HousingBalanceRead } from "../../shared/HousingBalanceRead";
import { SOCIAL_DESTINATIONS } from "../../shared/socialDestinations";
import { verifiedHousingBalanceReel } from "./verifiedHousingBalanceReel";
import { validateStoryboard } from "../video/storyboard";
import { composeSections, layout } from "../video/statReel";
import { subtitleCues } from "../video/subtitles";
import { isKnownRoute } from "../core/spaShell";

const evidence = () => structuredClone(HOUSING_BALANCE_SNAPSHOT);
const now = new Date("2026-09-09T12:00:00Z");
describe("matched historical housing flows", () => {
  it("subtracts net additions from new demand in the same national 18 months", () => {
    expect(matchedHousingBalance(evidence())).toMatchObject({
      gross: 263000,
      net: 232000,
      demand: 287000,
      shortfall: 55000,
      netBalance: -55000,
      netPer100: 81,
      impliedRemovals: 31000,
      scope: "Australia",
      start: "2024-07-01",
      end: "2025-12-31",
    });
  });
  it.each([
    ["scope", "Greater Brisbane"],
    ["unit", "people"],
    ["start", "2025-07-01"],
    ["end", "2026-12-31"],
    ["basis", "forecast"],
    ["value", 263000],
    ["value", 0],
    ["value", NaN],
    ["approximate", false],
    ["measure", "approvals"],
  ])("withholds mismatched %s=%s instead of calculating a gap", (key, value) => {
    const data = evidence();
    Object.assign(data.observations[1]!, { [key]: value });
    expect(matchedHousingBalance(data)).toBeNull();
    expect(verifiedHousingBalanceReel(data, now)).toBeNull();
  });
  it("requires complete evidence and the reviewed source identity", () => {
    expect(matchedHousingBalance(null)).toBeNull();
    const missing = evidence();
    missing.observations.pop();
    expect(matchedHousingBalance(missing)).toBeNull();
    const duplicate = evidence();
    duplicate.observations[1] = duplicate.observations[0]!;
    expect(matchedHousingBalance(duplicate)).toBeNull();
    for (const change of [
      { sourceSha256: "unverified" },
      { pdfPage: 33 },
      { publishedAt: "2026-05-01" },
    ]) {
      expect(matchedHousingBalance({ ...evidence(), ...change })).toBeNull();
    }
  });
  it("keeps the historical publication identity stable and expires the reviewed vintage", () => {
    const first = verifiedHousingBalanceReel(evidence(), now)!;
    const rechecked = { ...evidence(), verifiedAt: "2026-10-01" };
    const later = verifiedHousingBalanceReel(rechecked, new Date("2026-10-02"))!;
    expect(later.publication).toEqual(first.publication);
    expect(later.evidenceHash).not.toBe(first.evidenceHash);
    for (const date of ["2026-04-29", "2026-09-08", "2027-04-30", "invalid"])
      expect(verifiedHousingBalanceReel(evidence(), new Date(date))).toBeNull();
  });
});

describe("the finding survives the Reel and source destination", () => {
  it("keeps voice, visuals and subtitles together and rejects changed or reordered claims", () => {
    const c = verifiedHousingBalanceReel(evidence(), now)!;
    const story = c.stat.storyboard!;
    expect(() => validateStoryboard(story, c.script)).not.toThrow();
    expect(() => validateStoryboard(story, [...c.script].reverse())).toThrow();
    const changed = structuredClone(story);
    changed.scenes[4]!.text = "A gap of a million homes.";
    expect(() => validateStoryboard(changed, c.script)).toThrow();
    const durations = Object.fromEntries(c.script.map(({ key }, i) => [key, 2 + i / 10]));
    const sections = composeSections(c.stat, durations),
      timing = layout(sections);
    expect(sections.map((s) => s.key)).toEqual(c.script.map((s) => s.key));
    const cues = subtitleCues(
      c.script,
      sections.map((s, i) => ({
        key: s.key,
        start: timing.starts[i]!,
        seconds: durations[s.key]!,
      }))
    );
    expect(cues.flatMap((c) => c.lines).join(" ")).toBe(c.script.map((s) => s.text).join(" "));
    expect(c.script.map((s) => s.text).join(" ")).toContain("eighty-one");
    const fullLength = composeSections(c.stat, { ...durations, claim: 4.5 });
    const houses = fullLength.find((s) => s.key === "claim")!;
    expect(houses.frames).toHaveLength(81);
    expect(houses.frames.map((f) => Math.round(f.sceneProgress! * 81))).toEqual(
      Array.from({ length: 81 }, (_, i) => i + 1)
    );
    expect(layout(fullLength).total).toBeGreaterThan(4.5);
  });
  it("provides a readable caption and a resolvable source destination with matching figures", () => {
    const c = verifiedHousingBalanceReel(evidence(), now)!;
    expect(c.caption.length).toBeLessThanOrEqual(1400);
    expect(c.caption).not.toMatch(/—|\b(?:modeled|analyze|center|color)\b/);
    for (const term of [
      "July 2024 to December 2025",
      "55,000",
      "81",
      "total accumulated shortage",
      "modelled",
    ])
      expect(c.caption).toContain(term);
    const destination = SOCIAL_DESTINATIONS.find((d) => d.path === "/markets/housing-balance")!;
    expect(c.caption).toContain(destination.label);
    expect(isKnownRoute(destination.path)).toBe(true);
    const html = renderToStaticMarkup(React.createElement(HousingBalanceRead));
    for (const term of [
      "263,000",
      "232,000",
      "287,000",
      "55,000",
      "homelessness",
      "#page=32",
      "#page=104",
    ])
      expect(html).toContain(term);
  });
});
