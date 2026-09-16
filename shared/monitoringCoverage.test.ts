import { expect, it } from "vitest";
import { monitoringCoverage } from "./monitoringCoverage";
it("exposes the audited multi-hour sampling gaps even if every probe passed", () => {
  expect(
    monitoringCoverage(5, "2026-09-15T19:52:00Z", new Date("2026-09-15T21:00:00Z"))
  ).toMatchObject({ expected: 288, sparse: true, stale: true, ageMinutes: 68 });
  expect(monitoringCoverage(0, null)).toMatchObject({
    sparse: true,
    stale: true,
    ageMinutes: null,
  });
});
