import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAbsApprovals } from "../markets/absApprovals";
import { verifiedSupplyReel } from "./verifiedSupplyReel";
import { scriptFitsClip } from "../video/statReel";
const now = new Date("2026-09-08T12:00:00Z");
const data = () =>
  parseAbsApprovals(
    readFileSync(new URL("../markets/fixtures/abs-approvals.csv", import.meta.url), "utf8"),
    now.toISOString()
  );

describe("verified approvals story", () => {
  it("uses comparable annual counts with an interpretation and an explicit source trail", () => {
    const reel = verifiedSupplyReel(data(), now)!;
    expect(reel).not.toBeNull();
    expect(reel.stat.value).toBe("27,628");
    expect(reel.stat.facts?.[1]?.figure).toBe("22,229");
    expect(reel.caption).toContain("Greater Brisbane");
    expect(reel.caption).toContain("twelve consecutive monthly ABS original counts");
    expect(reel.caption).toContain("ABS,BA_GCCSA,1.0.0");
    expect(reel.caption).toContain("not starts or completed homes");
    expect(reel.script.map((line) => line.text).join(" ")).toContain(
      "Counts alone don't measure a shortage"
    );
    expect(scriptFitsClip(reel.script)).toBe(true);
  });
  it("skips unavailable, missing, mismatched, stale and future observations", () => {
    for (const change of [
      (d: ReturnType<typeof data>) => {
        d.status = "unavailable";
      },
      (d: ReturnType<typeof data>) => {
        d.observations = d.observations.filter(
          (r) => !(r.city === "Perth" && r.period === "2026-07")
        );
      },
      (d: ReturnType<typeof data>) => {
        d.observations = d.observations.filter((r) => r.period !== "2026-02");
      },
      (d: ReturnType<typeof data>) => {
        d.observations.push({ city: "Brisbane", period: "2026-09", dwellings: 1, status: "" });
      },
    ]) {
      const d = data();
      change(d);
      expect(verifiedSupplyReel(d, now)).toBeNull();
    }
    expect(verifiedSupplyReel(data(), new Date("2027-01-01"))).toBeNull();
  });
  it("fails closed on suppressed, duplicated, fractional or negative counts and unknown flags", () => {
    for (const value of [null, -1, 1.5, NaN, Infinity]) {
      const d = data();
      d.observations.find((r) => r.city === "Brisbane")!.dwellings = value;
      expect(verifiedSupplyReel(d, now)).toBeNull();
    }
    const duplicate = data();
    duplicate.observations.push(duplicate.observations[0]!);
    expect(verifiedSupplyReel(duplicate, now)).toBeNull();
    const flagged = data();
    flagged.observations[0]!.status = "x";
    expect(verifiedSupplyReel(flagged, now)).toBeNull();
  });
  it("keeps the same publication lock across revisions while updating the evidence hash and caveat", () => {
    const before = verifiedSupplyReel(data(), now)!;
    const d = data();
    d.observations.find((r) => r.city === "Brisbane" && r.period === "2026-07")!.status = "r";
    const after = verifiedSupplyReel(d, now)!;
    expect(after.publication).toEqual(before.publication);
    expect(after.evidenceHash).not.toBe(before.evidenceHash);
    expect(after.caption).toContain("includes revised observations");
    expect(
      verifiedSupplyReel({ ...d, observations: [...d.observations].reverse() }, now)!.evidenceHash
    ).toBe(after.evidenceHash);
  });
});
