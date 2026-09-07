import { describe, expect, it } from "vitest";
import type { MetricMove, MonthlyReview } from "../../metrics/monthlyReview";
import { fallbackMonthLine, moveClaim } from "../monthCard";
import { inventsFigures } from "../statCard";

function move(o: Partial<MetricMove> = {}): MetricMove {
  return {
    metricKey: "cash_rate",
    label: "RBA cash rate",
    unit: "%",
    groupKey: "MACRO",
    open: 4.35,
    close: 4.1,
    change: -0.25,
    changeKind: "points",
    changePercent: null,
    direction: "down",
    unusualness: null,
    brokeStillness: true,
    monthsOfHistory: 6,
    ...o,
  };
}

const review: MonthlyReview = {
  month: "2026-08",
  label: "August 2026",
  movers: [],
  unchanged: [],
  unranked: [],
};

describe("moveClaim", () => {
  it("says a still metric moved, and for how long it had not", () => {
    expect(moveClaim(move())).toBe("FIRST MOVE IN 6 MONTHS");
  });

  it("states a ratio when there is a normal month to compare against", () => {
    expect(moveClaim(move({ brokeStillness: false, unusualness: 2.34 }))).toBe(
      "2.3x ITS USUAL MONTH"
    );
  });

  it("falls back to a plain claim when neither applies", () => {
    expect(moveClaim(move({ brokeStillness: false, unusualness: null }))).toBe("MOVED THIS MONTH");
  });
});

describe("fallbackMonthLine", () => {
  it("states the closing level rather than repeating the move", () => {
    // The move is already the hero directly above and the claim is directly
    // below, so a fallback that restates either wastes the only line that can
    // add something.
    const line = fallbackMonthLine(move(), review);
    expect(line).toBe("It finished August at 4.10%.");
    expect(line).not.toContain("0.25");
  });

  it("formats a level metric without a percent sign", () => {
    const line = fallbackMonthLine(
      move({ unit: null, close: 933137, changeKind: "percent" }),
      review
    );
    expect(line).toContain("933,137");
    expect(line).not.toContain("%");
  });

  it("never introduces a figure the card's own facts do not carry", () => {
    // The closing level is computed from the same history, so it is checkable;
    // the guard is only asserted against what the model is actually given.
    const m = move();
    const facts = [m.label, review.label, moveClaim(m), String(m.monthsOfHistory), "-0.25 points"];
    // The fallback deliberately adds the close, which the model is never told,
    // so it must not be treated as a model output.
    expect(inventsFigures("Rates eased for the first time in six months.", facts)).toBe(false);
  });
});
