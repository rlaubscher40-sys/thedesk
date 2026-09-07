import { describe, expect, it } from "vitest";
import { buildTrendPath } from "./trendCard";

describe("buildTrendPath", () => {
  it("maps an increasing series from left to right without NaN", () => {
    const chart = buildTrendPath([10, 20, 30], 300, 120, 10);
    expect(chart.min).toBe(10);
    expect(chart.max).toBe(30);
    expect(chart.d).toContain("M 10.00");
    expect(chart.d).toContain("L 290.00");
    expect(chart.d).not.toContain("NaN");
  });

  it("handles a flat series safely", () => {
    const chart = buildTrendPath([5, 5, 5], 300, 120, 10);
    expect(chart.min).toBe(5);
    expect(chart.max).toBe(5);
    expect(chart.d).not.toContain("NaN");
    expect(chart.d).not.toContain("Infinity");
  });

  it("returns an empty path for no history", () => {
    expect(buildTrendPath([])).toEqual({ d: "", min: 0, max: 0 });
  });
});
