import { expect, it } from "vitest";
import { monitoringCoverage } from "./monitoringCoverage";
it("exposes the audited multi-hour sampling gaps even if every probe passed", () => {
  expect(
    monitoringCoverage(["2026-09-15T19:52:00Z"], new Date("2026-09-15T21:00:00Z"))
  ).toMatchObject({ expected: 288, sparse: true, stale: true, ageMinutes: 68 });
  expect(monitoringCoverage([])).toMatchObject({
    sparse: true,
    stale: true,
    ageMinutes: null,
  });
});

const now = new Date("2026-09-16T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
it("does not confuse hundreds of clustered checks with full-day coverage", () => {
  expect(
    monitoringCoverage(
      Array.from({ length: 500 }, () => ago(1)),
      now
    )
  ).toMatchObject({
    observedIntervals: 1,
    coveragePercent: 0.3,
    stale: false,
    sparse: true,
    longestGapMinutes: 1439,
    hasLongGap: true,
  });
});
it("recognises checks distributed throughout the complete window", () => {
  expect(
    monitoringCoverage(
      Array.from({ length: 288 }, (_, i) => ago(i * 5 + 1)),
      now
    )
  ).toMatchObject({
    observedIntervals: 288,
    coveragePercent: 100,
    sparse: false,
    stale: false,
    longestGapMinutes: 5,
    hasLongGap: false,
  });
});
it("flags a long internal gap even above 80% coverage with a recent check", () => {
  const samples = Array.from({ length: 288 }, (_, i) => ago(i * 5 + 1)).filter(
    (_, i) => i < 100 || i > 110
  );
  expect(monitoringCoverage(samples, now)).toMatchObject({
    sparse: false,
    stale: false,
    longestGapMinutes: 60,
    hasLongGap: true,
  });
});
it("excludes invalid, old and future timestamps and includes both window edges", () => {
  expect(monitoringCoverage(["invalid", ago(-1), ago(1441)], now)).toMatchObject({
    observedIntervals: 0,
    ageMinutes: null,
    longestGapMinutes: 1440,
  });
  expect(monitoringCoverage([ago(1440), now], now)).toMatchObject({
    observedIntervals: 2,
    longestGapMinutes: 1440,
    stale: false,
  });
});
