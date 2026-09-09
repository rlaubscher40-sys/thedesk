import { describe, it, expect } from "vitest";
import { verifiedSydneyBeforeBuy, verifiedSydneyRentChange } from "./verifiedSydneyReels";
import { scriptFitsClip } from "../video/statReel";
import type { CityRents } from "../../shared/cityRents";
import type { CityApprovals } from "../../shared/cityApprovals";
const now = new Date("2026-09-09T08:30:00Z");
const rents = (): CityRents => ({
  status: "available",
  retrievedAt: now.toISOString(),
  observations: [
    { city: "Sydney", period: "2026-07", annualPercent: 3.5, status: "" },
    { city: "Sydney", period: "2026-06", annualPercent: 3.8, status: "" },
  ],
});
const approvals = (): CityApprovals => ({
  status: "available",
  retrievedAt: now.toISOString(),
  observations: Array.from({ length: 12 }, (_, i) => ({
    city: "Sydney",
    period: new Date(Date.UTC(2026, 6 - i, 1)).toISOString().slice(0, 7),
    dwellings: 1000 + i,
    status: "",
  })),
});
describe("automatic Sydney story recipes", () => {
  it("writes a slower annual rate without claiming monthly falls, and links matching evidence", () => {
    const c = verifiedSydneyRentChange(rents(), now)!;
    expect(c.stat.value).toBe("-0.3pp");
    expect(c.script.map((s) => s.text).join(" ")).toContain("still higher than a year earlier");
    expect(c.caption).toContain("not the percentage change in rents during the latest month");
    expect(c.caption).toContain("sydney_rent_change#rental-conditions");
    expect(c.caption).toContain("slower rent growth as falling rents");
    expect(scriptFitsClip(c.script)).toBe(true);
  });
  it.each([-1, 0, 4.1])("explains the actual sign of the annual rate %s", (value) => {
    const d = rents();
    d.observations[0]!.annualPercent = value;
    const c = verifiedSydneyRentChange(d, now)!;
    expect(c.script.find((s) => s.key === "claim")?.text).toContain(
      value < 0 ? "lower" : value === 0 ? "unchanged" : "higher"
    );
    expect(c.caption).toContain("the period and definition matter");
    expect(c.caption).not.toContain("slower rent growth as falling rents");
  });
  it("requires a real change and consecutive current, valid observations", () => {
    const changes: Array<(d: CityRents) => void> = [
      (d) => {
        d.status = "unavailable";
      },
      (d) => {
        d.retrievedAt = "2025-01-01";
      },
      (d) => {
        d.observations[1]!.period = "2026-05";
      },
      (d) => {
        d.observations[1]!.period = "2026-07";
      },
      (d) => {
        d.observations[0]!.period = "2026-09";
      },
      (d) => {
        d.observations[0]!.annualPercent = NaN;
      },
      (d) => {
        d.observations[0]!.annualPercent = 3.81;
      },
      (d) => {
        d.observations[0]!.annualPercent = 3.8;
      },
      (d) => {
        d.observations.pop();
      },
    ];
    for (const change of changes) {
      const d = rents();
      change(d);
      expect(verifiedSydneyRentChange(d, now)).toBeNull();
    }
    expect(verifiedSydneyRentChange(rents(), new Date("bad"))).toBeNull();
  });
  it("writes a three-part buyer checklist from twelve approvals, never completions", () => {
    const c = verifiedSydneyBeforeBuy(approvals(), now)!;
    expect(c.stat.value).toBe("12,066");
    expect(c.caption).toContain("Greater Sydney");
    expect(c.caption).toContain("not a start or a completion");
    expect(c.caption).toContain("sydney_before_buy#housing-approvals");
    expect(scriptFitsClip(c.script)).toBe(true);
  });
  it("blocks missing months, suppressed/fractional/negative counts, duplicate periods and unknown flags", () => {
    for (const invalid of [null, -1, 1.2, NaN]) {
      const d = approvals();
      d.observations[0]!.dwellings = invalid;
      expect(verifiedSydneyBeforeBuy(d, now)).toBeNull();
    }
    for (const change of [
      (d: CityApprovals) => {
        d.observations.pop();
      },
      (d: CityApprovals) => {
        d.observations[0]!.status = "x";
      },
      (d: CityApprovals) => {
        d.observations.push(d.observations[0]!);
      },
      (d: CityApprovals) => {
        d.retrievedAt = "2025-01-01";
      },
    ]) {
      const d = approvals();
      change(d);
      expect(verifiedSydneyBeforeBuy(d, now)).toBeNull();
    }
  });
  it("revisions change the evidence hash but never reset either monthly publication lock", () => {
    for (const [data, build] of [
      [rents(), verifiedSydneyRentChange],
      [approvals(), verifiedSydneyBeforeBuy],
    ] as const) {
      const before = (
        build as (d: unknown, n: Date) => ReturnType<typeof verifiedSydneyRentChange>
      )(data, now)!;
      data.observations[0]!.status = "r";
      const after = (build as (d: unknown, n: Date) => ReturnType<typeof verifiedSydneyRentChange>)(
        data,
        now
      )!;
      expect(after.publication).toEqual(before.publication);
      expect(after.evidenceHash).not.toBe(before.evidenceHash);
      expect(after.caption).toContain("revised");
    }
  });
});
