import { expect, it } from "vitest";
import { analyseRentPressure, RENT_PRESSURE_RELEASE as release } from "./rentPressure";
import download from "../client/public/research/rent-pressure-2026-07.json";
it("reproduces the complete frozen ABS reading and downloadable inputs", () => {
  const result = analyseRentPressure(release.observations, release.id)!;
  expect(result).toMatchObject({
    slower: 1,
    faster: 2,
    unchanged: 5,
    positive: 8,
    spread: 4.7,
    priorSpread: 4.3,
  });
  expect(result.rows.find((row) => row.city === "Darwin")?.change).toBe(0.4);
  expect(result.rows.find((row) => row.city === "Melbourne")?.change).toBe(-0.1);
  expect(download.observations).toEqual(release.observations);
  expect(download.workbookSha256).toBe(release.workbookSha256);
});
it("withholds incomplete, duplicate or suppressed series and mismatched periods", () => {
  expect(analyseRentPressure(release.observations.slice(1), release.id)).toBeNull();
  expect(
    analyseRentPressure([...release.observations, release.observations[0]!], release.id)
  ).toBeNull();
  const rows = structuredClone(release.observations);
  rows[0]!.status = "np";
  expect(analyseRentPressure(rows, release.id)).toBeNull();
  expect(analyseRentPressure(release.observations, "2026-08")).toBeNull();
  expect(analyseRentPressure(release.observations, "2026-13")).toBeNull();
});
