import { expect, it } from "vitest";
import { formatMetricValue, historyChange } from "./metricPresentation";
const series = [
  { value: 4, recordedAt: new Date("2026-09-01") },
  { value: 4.25, recordedAt: new Date("2026-09-10") },
];
it("formats Australian count, money and percentage units without double suffixes", () => {
  expect(formatMetricValue({ value: "8641100", unit: "people" })).toBe("8,641,100 people");
  expect(formatMetricValue({ value: "10500.50", unit: "$" })).toBe("$10,500.50");
  expect(formatMetricValue({ value: "4.25%", unit: "%" })).toBe("4.25%");
});
it("describes rate differences in percentage points with actual stored dates", () => {
  expect(historyChange({ metricKey: "cash_rate", unit: "%" }, series)).toBe(
    "+0.25 percentage points · 1 Sept to 10 Sept"
  );
});
it("does not turn collection history into a monthly economic movement", () => {
  expect(historyChange({ metricKey: "building_approvals" }, series)).toContain(
    "not release-to-release changes"
  );
});
it("keeps zero baselines and missing history distinct from flat observations", () => {
  expect(historyChange({ metricKey: "asx200" }, [])).toContain("Not enough");
  expect(
    historyChange({ metricKey: "asx200" }, [{ ...series[0]!, value: 0 }, series[1]!])
  ).toContain("unavailable from a zero");
});
