import { describe, expect, it } from "vitest";
import { exampleRepayments, loanDollars, monthlyRepayment } from "./loanRepaymentExample";

describe("reviewed repayment illustration", () => {
  it("computes rounded results from unrounded monthly amortisation", () => {
    const [long, short] = exampleRepayments();
    expect(long!.monthly).toBeCloseTo(2997.7526257637846, 8);
    expect(short!.monthly).toBeCloseTo(3221.507007427569, 8);
    expect(loanDollars(long!.monthly)).toBe("$2,998");
    expect(loanDollars(short!.monthly)).toBe("$3,222");
    expect(short!.interest).toBeLessThan(long!.interest);
    // Independent month-by-month balance check, not the annuity formula again.
    for (const r of exampleRepayments()) {
      let balance = 500_000;
      for (let m = 0; m < r.years * 12; m++) balance = balance * 1.005 - r.monthly;
      expect(Math.abs(balance)).toBeLessThan(0.000001);
    }
  });
  it("handles zero interest without NaN and rejects invalid assumptions", () => {
    expect(monthlyRepayment(120_000, 0, 10)).toBe(1000);
    for (const inputs of [
      [NaN, 6, 30],
      [-1, 6, 30],
      [500_000, -1, 30],
      [500_000, Infinity, 30],
      [500_000, 6, 0],
      [500_000, 6, 25.5],
    ])
      expect(() => monthlyRepayment(inputs[0]!, inputs[1]!, inputs[2]!)).toThrow();
  });
});
