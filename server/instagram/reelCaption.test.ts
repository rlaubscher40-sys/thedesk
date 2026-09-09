import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildReelCaption, REEL_CAPTION_LIMIT, REEL_READS } from "./reelCaption";
import { verifiedRentReel } from "./verifiedReel";
import { verifiedSupplyReel } from "./verifiedSupplyReel";
import { verifiedSydneyBeforeBuy, verifiedSydneyRentChange } from "./verifiedSydneyReels";
import { verifiedCapitalRentReel } from "./verifiedCapitalRentReel";
import { parseAbsApprovals } from "../markets/absApprovals";
import { RENT_CITIES, type CityRents } from "../../shared/cityRents";
import { scriptFitsClip } from "../video/statReel";
const now = new Date("2026-09-09T10:00:00Z");
const rents: CityRents = {
  status: "available",
  retrievedAt: now.toISOString(),
  observations: RENT_CITIES.flatMap((city, i) => [
    { city, period: "2026-07", annualPercent: 5.3 - i / 10, status: "r" },
    { city, period: "2026-06", annualPercent: 5.5 - i / 10, status: "p" },
  ]),
};
const approvals = () =>
  parseAbsApprovals(
    readFileSync(new URL("../markets/fixtures/abs-approvals.csv", import.meta.url), "utf8"),
    now.toISOString()
  );
const sydneyApprovals = () => ({
  ...approvals(),
  observations: Array.from({ length: 12 }, (_, i) => ({
    city: "Sydney" as const,
    period: new Date(Date.UTC(2026, 6 - i, 1)).toISOString().slice(0, 7),
    dwellings: 1200 + i,
    status: i % 2 ? "p" : "r",
  })),
});

describe("repeatable concise Reel captions", () => {
  it("gives all five recipes one short, sourced, revision-aware caption with one valid reading URL", () => {
    const recipes = [
      verifiedRentReel(rents, now),
      verifiedSupplyReel(approvals(), now),
      verifiedSydneyRentChange(rents, now),
      verifiedSydneyBeforeBuy(sydneyApprovals(), now),
      verifiedCapitalRentReel(rents, now),
    ];
    const reads = [
      "rentComparison",
      "supplyComparison",
      "sydneyRent",
      "sydneySupply",
      "capitalRents",
    ] as const;
    for (const [index, recipe] of recipes.entries()) {
      expect(recipe).not.toBeNull();
      const read = reads[index]!;
      const label = REEL_READS[read].label;
      expect(recipe!.script.find((line) => line.key === "signOff")?.text).toContain(label);
      expect(scriptFitsClip(recipe!.script)).toBe(true);
      if (read === "sydneySupply") {
        // Keep the complete educational checklist rather than replacing Timing with a CTA.
        expect(recipe!.stat.facts?.map((fact) => fact.figure)).toEqual([
          "1 · Stage",
          "2 · Place",
          "3 · Timing",
        ]);
      } else {
        expect(recipe!.stat.facts?.at(-1)).toEqual({ figure: "Open our bio", caption: label });
        expect(label.length).toBeLessThanOrEqual(44); // Card renderer's full-caption limit.
      }
      const caption = recipe!.caption;
      expect(caption).toContain(`Bio → ${label}`);
      expect(caption.length).toBeLessThanOrEqual(REEL_CAPTION_LIMIT);
      expect(caption.split("\n")[0]!.length).toBeLessThanOrEqual(110);
      expect(caption).toContain("Source: ABS");
      expect(caption).toContain("July 2026");
      expect(caption).toContain("can be revised");
      expect(caption).toContain("Source pages update; match the post's reference period.");
      expect(caption.match(/https?:\/\/\S+/g)).toHaveLength(1);
      const url = new URL(caption.match(/https?:\/\/\S+/)![0]);
      expect(url.origin).toBe("https://thedesk.au");
      expect(url.hash).toBe("");
      expect(caption.match(/#[\w-]+/g)).toEqual(["#AusProperty", "#PropertyData", "#TheDesk"]);
      expect(caption).not.toMatch(/data\.api\.abs|Verified series:/);
    }
    expect(recipes[3]!.caption).toContain("Includes provisional observations.");
    expect(recipes[3]!.caption).toContain("Includes revised observations.");
  });
  it("keeps signed rates, ties and every capital's revision flag", () => {
    const negative = {
      ...rents,
      observations: rents.observations.map((row) => ({ ...row, annualPercent: -1.2 })),
    };
    const result = verifiedCapitalRentReel(negative, now)!;
    for (const city of RENT_CITIES) expect(result.caption).toContain(`${city}: -1.2% (revised)`);
    expect(result.caption).toContain("0.0 percentage points");
    expect(result.caption).toContain("not a national average");
  });
  it("preserves the existing permanent topic keys across caption revisions", () => {
    expect(verifiedSupplyReel(approvals(), now)!.publication).toEqual({
      key: "instagram-reel-abs-approvals-brisbane-perth-v1",
      date: "2026-07-01",
    });
    expect(verifiedSydneyBeforeBuy(sydneyApprovals(), now)!.publication.key).toBe(
      "instagram-reel-abs-sydney-before-buy-v1"
    );
  });
  it("fails rather than truncating long facts or admitting arbitrary URLs", () => {
    const valid = {
      hook: "What changed?",
      finding: "Finding.",
      meaning: "Meaning.",
      method: "Source: ABS.",
      revisions: "Data can be revised.",
      action: "Save the checklist.",
      read: "sydneySupply" as const,
    };
    expect(() => buildReelCaption({ ...valid, finding: "F".repeat(1500) })).toThrow(
      "no factual truncation"
    );
    expect(() => buildReelCaption({ ...valid, meaning: "" })).toThrow("complete plain-text");
    expect(() => buildReelCaption({ ...valid, action: "Go https://evil.example" })).toThrow(
      "plain-text"
    );
    expect(() => buildReelCaption({ ...valid, read: "toString" as never })).toThrow("Unknown");
    expect(Object.values(REEL_READS).every((read) => read.path.startsWith("/"))).toBe(true);
  });
});
