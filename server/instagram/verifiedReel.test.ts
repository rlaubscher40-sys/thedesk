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
    expect(reel.caption).toContain("data.api.abs.gov.au");
    expect(reel.stat.series).toBeUndefined(); // Two cities are not a time series.
    expect(scriptFitsClip(reel.script)).toBe(true);
    expect(reel.script.at(-1)!.text).toContain("free comparison");
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
});
