import { describe, expect, it } from "vitest";
import { RENT_CITIES, type CityRents } from "../../shared/cityRents";
import { verifiedCapitalRentReel } from "./verifiedCapitalRentReel";

const now = new Date("2026-09-08T10:00:00Z");
export const capitalRentFixture = (): CityRents => ({
  status: "available",
  retrievedAt: now.toISOString(),
  observations: RENT_CITIES.map((city, index) => ({
    city,
    period: "2026-07",
    annualPercent: [3.5, 3.1, 4.6, 4.2, 5.3, 2.1, 3.8, 1.9][index]!,
    status: "",
  })),
});
describe("verified eight-capital rent story", () => {
  it("uses all eight matching observations, correct range, complete caption and relevant destination", () => {
    const reel = verifiedCapitalRentReel(capitalRentFixture(), now)!;
    expect(reel.stat.value).toBe("3.4pp");
    expect(reel.stat.facts?.[0]).toEqual({ figure: "5.3%", caption: "Perth · highest" });
    expect(reel.stat.facts?.[1]).toEqual({ figure: "1.9%", caption: "Canberra · lowest" });
    for (const city of RENT_CITIES) expect(reel.caption).toContain(`${city}:`);
    expect(reel.caption).toContain("Year to July 2026");
    expect(reel.caption).toContain("https://thedesk.au/social?");
    expect(reel.caption).not.toContain("/compare");
    expect(reel.caption.length).toBeLessThanOrEqual(2200);
    expect(reel.script.map((line) => line.key)).toEqual([
      "label",
      "value",
      "line",
      "claim",
      "facts",
      "signOff",
    ]);
    expect(reel.script.map((line) => line.text).join(" ")).toContain("not an Australian average");
    expect(reel.stat.subtext).toContain("Not a national average");
  });
  it.each([
    "unavailable",
    "missing",
    "mismatched",
    "stale",
    "future",
    "bad-month",
    "duplicate",
    "unknown-flag",
    "nonfinite",
    "impossible",
    "precision",
    "unknown-city",
    "old-retrieval",
    "future-retrieval",
    "invalid-retrieval",
  ])("rejects %s evidence without falling back to a subset or older month", (kind) => {
    const data = capitalRentFixture();
    const row = data.observations[0]!;
    switch (kind) {
      case "unavailable":
        data.status = "unavailable";
        break;
      case "missing":
        data.observations.pop();
        break;
      case "mismatched":
        row.period = "2026-06";
        break;
      case "stale":
        data.observations.forEach((row) => (row.period = "2026-05"));
        break;
      case "future":
        row.period = "2026-09";
        break;
      case "bad-month":
        row.period = "2026-13";
        break;
      case "duplicate":
        data.observations.push({ ...row });
        break;
      case "unknown-flag":
        row.status = "x" as "r";
        break;
      case "nonfinite":
        row.annualPercent = NaN;
        break;
      case "impossible":
        row.annualPercent = -101;
        break;
      case "precision":
        row.annualPercent = 3.51;
        break;
      case "unknown-city":
        row.city = "New South Wales";
        break;
      case "old-retrieval":
        data.retrievedAt = "2026-09-06T10:00:00Z";
        break;
      case "future-retrieval":
        data.retrievedAt = "2026-09-09T10:00:00Z";
        break;
      case "invalid-retrieval":
        data.retrievedAt = "not a date";
        break;
    }
    expect(verifiedCapitalRentReel(data, now)).toBeNull();
  });
  it("handles negative rates and tied endpoints without calling them rent levels or a winning city", () => {
    const data = capitalRentFixture();
    data.observations.forEach((row, index) => (row.annualPercent = index < 4 ? -1.2 : -3.5));
    const reel = verifiedCapitalRentReel(data, now)!;
    expect(reel.stat.value).toBe("2.3pp");
    expect(reel.stat.facts?.[0]).toEqual({ figure: "-1.2%", caption: "4 capitals tied highest" });
    expect(reel.stat.facts?.[1]).toEqual({ figure: "-3.5%", caption: "4 capitals tied lowest" });
    expect(reel.script.map((row) => row.text).join(" ")).not.toMatch(/rents rose|winner|best buy/);
  });
  it("explains a zero range without implying zero rent change", () => {
    const data = capitalRentFixture();
    data.observations.forEach((row) => (row.annualPercent = 4));
    const reel = verifiedCapitalRentReel(data, now)!;
    expect(reel.stat.value).toBe("0.0pp");
    expect(reel.stat.facts?.[0]?.figure).toBe("4.0%");
    expect(reel.script[1]?.text).toContain("same annual change");
  });
  it("preserves the month lock across revisions while evidence hashes change", () => {
    const data = capitalRentFixture();
    const first = verifiedCapitalRentReel(data, now)!;
    data.observations[0]!.status = "r";
    data.observations[0]!.annualPercent = 3.6;
    const revision = verifiedCapitalRentReel(data, now)!;
    expect(revision.publication).toEqual(first.publication);
    expect(revision.evidenceHash).not.toBe(first.evidenceHash);
    expect(revision.caption).toContain("Sydney: 3.6% (revised)");
    data.observations.reverse();
    expect(verifiedCapitalRentReel(data, now)?.evidenceHash).toBe(revision.evidenceHash);
  });
  it("selects latest observations in a two-month feed without accepting an incomplete latest release", () => {
    const data = capitalRentFixture();
    data.observations.push(...data.observations.map((row) => ({ ...row, period: "2026-06" })));
    expect(verifiedCapitalRentReel(data, now)?.publication.date).toBe("2026-07-01");
    data.observations.push({ ...data.observations[0]!, period: "2026-08" });
    expect(verifiedCapitalRentReel(data, now)).toBeNull();
  });
  it("allows the bounded fetch to finish after the scheduler captured its clock", () => {
    const data = capitalRentFixture();
    data.retrievedAt = "2026-09-08T10:00:15Z";
    expect(verifiedCapitalRentReel(data, now)).not.toBeNull();
  });
});
