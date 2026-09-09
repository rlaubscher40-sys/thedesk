import { describe, expect, it } from "vitest";
import type { CityRents } from "../../shared/cityRents";
import { scriptFitsClip } from "../video/statReel";
import { verifiedRentReel } from "./verifiedReel";

const now = new Date("2026-09-08T10:00:00Z");
const data = (): CityRents => ({
  status: "available",
  retrievedAt: now.toISOString(),
  observations: [
    { city: "Brisbane", annualPercent: 4.6, period: "2026-07", status: "" },
    { city: "Perth", annualPercent: 5.3, period: "2026-07", status: "r" },
  ],
});
describe("verified rent Reel", () => {
  it("keeps geography, period, source, revision and percentage-point identity", () => {
    const reel = verifiedRentReel(data(), now)!;
    expect(reel.stat.value).toBe("0.7pp");
    expect(reel.stat.line).toContain("Perth");
    expect(reel.caption).toContain("Perth: revised");
    expect(reel.caption).toContain("Year to July 2026");
    expect(reel.caption).toContain("Source: ABS CPI rents actually paid");
    expect(reel.caption).toContain("https://thedesk.au/markets/compare/brisbane-vs-perth?");
    expect(reel.stat.series).toBeUndefined(); // Two cities are not a time series.
    expect(scriptFitsClip(reel.script)).toBe(true);
    expect(reel.script.at(-1)!.text).toContain("Brisbane vs Perth rents");
  });
  it("withholds missing, stale, mismatched and future observations", () => {
    expect(verifiedRentReel({ ...data(), status: "unavailable" }, now)).toBeNull();
    for (const period of ["2026-01", "2026-09", "2026-10"]) {
      const d = data();
      d.observations.forEach((r) => (r.period = period));
      expect(verifiedRentReel(d, now)).toBeNull();
    }
    const d = data();
    d.observations[0]!.period = "2026-06";
    expect(verifiedRentReel(d, now)).toBeNull();
  });
  it("does not invent a winner when growth is equal", () => {
    const d = data();
    d.observations[1]!.annualPercent = 4.6;
    expect(verifiedRentReel(d, now)!.stat.line).toContain("level");
  });
  it("preserves one monthly publication slot across revisions and restarts", () => {
    const before = verifiedRentReel(data(), now)!;
    const d = data();
    d.observations[1]!.annualPercent = 5.2;
    const revised = verifiedRentReel(d, now)!;
    expect(revised.publication).toEqual(before.publication);
    expect(revised.evidenceHash).not.toBe(before.evidenceHash);
  });
  it("explains the measure and decision inputs instead of reading the displayed rates", () => {
    const reel = verifiedRentReel(data(), now)!;
    const story = reel.script.map((l) => l.text).join(" ");
    expect(story).toContain("pace of change, not how expensive rents are");
    expect(story).toContain("purchase prices and costs");
    expect(story).toContain("Perth's rent index rose faster");
    expect(story).not.toContain("4.6");
    expect(story).not.toContain("5.3");
    expect(reel.caption).toContain("AI narration.");
    expect(reel.publication).toEqual({
      key: "instagram-reel-abs-rents-brisbane-perth-v1",
      date: "2026-07-01",
    });
  });
  it.each([
    [5.3, 4.6, "Brisbane"],
    [-1, -2, null],
    [-1, 1, null],
    [0, 0, null],
    [4.6, 4.61, null],
  ])("keeps direction, falls and rounding grounded for %s vs %s", (brisbane, perth, risingCity) => {
    const d = data();
    d.observations[0]!.annualPercent = brisbane;
    d.observations[1]!.annualPercent = perth;
    const reel = verifiedRentReel(d, now)!;
    const story = reel.script.map((l) => l.text).join(" ");
    expect(scriptFitsClip(reel.script)).toBe(true);
    if (risingCity) expect(story).toContain(`${risingCity}'s rent index rose faster`);
    else expect(story).not.toContain("rose faster");
    if (brisbane < 0 || perth < 0) expect(story).toContain("including falls");
    if (Math.abs(brisbane - perth) < 0.05) expect(story).toContain("Neither city's");
  });
});
