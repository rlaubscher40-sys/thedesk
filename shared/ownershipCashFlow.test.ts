import { describe, expect, it } from "vitest";
import { monthlyRepayment } from "./loanRepaymentExample";
import {
  DUE_DILIGENCE_SOURCES,
  firstYearSplit,
  OWNERSHIP_BOUNDS,
  OWNERSHIP_EXAMPLE,
  OWNERSHIP_EXCLUSIONS,
  ownershipCashFlow,
  ownershipInputsValid,
  ownershipScenarios,
  type OwnershipInputs,
} from "./ownershipCashFlow";

describe("first-year interest and principal split", () => {
  it("matches an independent month-by-month amortisation", () => {
    const split = firstYearSplit(600_000, 6, 30);
    let balance = 600_000;
    let interest = 0;
    for (let month = 0; month < 12; month++) {
      const charge = balance * 0.005;
      interest += charge;
      balance = balance + charge - split.monthly;
    }
    expect(split.monthly).toBeCloseTo(monthlyRepayment(600_000, 6, 30), 10);
    expect(split.interest).toBeCloseTo(interest, 8);
    expect(split.principalRepaid).toBeCloseTo(600_000 - balance, 8);
    // Twelve payments are exactly interest plus principal, with nothing lost.
    expect(split.interest + split.principalRepaid).toBeCloseTo(split.monthly * 12, 8);
  });

  it("charges no interest at a zero rate and repays only principal", () => {
    const split = firstYearSplit(120_000, 0, 10);
    expect(split.interest).toBe(0);
    expect(split.principalRepaid).toBeCloseTo(12_000, 10);
  });

  it("never amortises more than the loan has months left", () => {
    const split = firstYearSplit(120_000, 0, 1);
    expect(split.principalRepaid).toBeCloseTo(120_000, 8);
  });
});

describe("ownership cash flow", () => {
  const result = ownershipCashFlow(OWNERSHIP_EXAMPLE);

  it("computes the worked example exactly, checked by hand", () => {
    // 50 weeks let at $650 = $32,500 gross.
    expect(result.weeksLet).toBe(50);
    expect(result.grossRent).toBe(32_500);
    // 7% management on collected rent = $2,275.
    expect(result.managementFee).toBeCloseTo(2_275, 10);
    // Rates 2,400 + insurance 1,600 + maintenance 2,000 + strata 0 = $6,000.
    expect(result.holdingCosts).toBe(6_000);
    expect(result.operatingCosts).toBeCloseTo(8_275, 10);
    expect(result.netOperatingIncome).toBeCloseTo(24_225, 10);
    // Independently computed at 40-digit precision: monthly 3597.3031509165143…,
    // first-year interest 35799.5675373378…, principal 7368.0702736603…
    expect(result.loan.monthlyRepayment).toBeCloseTo(3597.3031509165143, 8);
    expect(result.loan.annualRepayment).toBeCloseTo(result.loan.monthlyRepayment * 12, 8);
    expect(result.loan.interest).toBeCloseTo(35_799.567537337859, 6);
    expect(result.loan.principalRepaid).toBeCloseTo(7_368.070273660313, 6);
    expect(result.netCashFlow).toBeCloseTo(-18_942.637810998172, 6);
    expect(result.netCashFlowPerWeek).toBeCloseTo(result.netCashFlow / 52, 10);
  });

  it("keeps principal out of the cost of holding the asset", () => {
    // The two figures differ by exactly the principal repaid — nothing else.
    expect(result.netOfInterestOnly - result.netCashFlow).toBeCloseTo(
      result.loan.principalRepaid,
      8
    );
    expect(result.netOfInterestOnly).toBeGreaterThan(result.netCashFlow);
  });

  it("reports no return on capital, because it does not know the asset's value", () => {
    expect(Object.keys(result)).not.toContain("yield");
    expect(Object.keys(result)).not.toContain("capitalGrowth");
    expect(Object.keys(result.loan)).not.toContain("equity");
  });

  it("treats a fully vacant year as no rent rather than negative rent", () => {
    const vacant = ownershipCashFlow({ ...OWNERSHIP_EXAMPLE, vacancyWeeks: 52 });
    expect(vacant.weeksLet).toBe(0);
    expect(vacant.grossRent).toBe(0);
    expect(vacant.managementFee).toBe(0);
    expect(vacant.netOperatingIncome).toBe(-6_000);
  });

  it("refuses invalid or missing inputs instead of returning a number", () => {
    const bad: Partial<OwnershipInputs>[] = [
      { loanBalance: 0 },
      { loanBalance: NaN },
      { annualRatePercent: -0.1 },
      { annualRatePercent: 30.1 },
      { termYears: 0 },
      { termYears: 25.5 },
      { rentPerWeek: -1 },
      { vacancyWeeks: 52.5 },
      { vacancyWeeks: -1 },
      { managementFeePercent: 21 },
      { councilRatesPerYear: -1 },
      { strataPerYear: Infinity },
    ];
    for (const patch of bad) {
      const inputs = { ...OWNERSHIP_EXAMPLE, ...patch } as OwnershipInputs;
      expect(ownershipInputsValid(inputs)).toBe(false);
      expect(() => ownershipCashFlow(inputs)).toThrow();
    }
    expect(ownershipInputsValid({ ...OWNERSHIP_EXAMPLE, rentPerWeek: undefined } as never)).toBe(
      false
    );
    expect(ownershipInputsValid(OWNERSHIP_EXAMPLE)).toBe(true);
  });

  it("bounds every input the reader can type", () => {
    const keys = Object.keys(OWNERSHIP_EXAMPLE).sort();
    expect(OWNERSHIP_BOUNDS.map((bound) => bound.key).sort()).toEqual(keys);
    for (const bound of OWNERSHIP_BOUNDS) expect(bound.max).toBeGreaterThan(bound.min);
  });
});

describe("downside scenarios", () => {
  const scenarios = ownershipScenarios(OWNERSHIP_EXAMPLE);
  const byKey = Object.fromEntries(scenarios.map((scenario) => [scenario.key, scenario]));

  it("makes every single-variable shift worse, and the combination worst", () => {
    for (const key of ["rate", "rent", "vacancy", "combined"])
      expect(byKey[key]!.change).toBeLessThan(0);
    expect(byKey.combined!.netCashFlow).toBeLessThan(
      Math.min(byKey.rate!.netCashFlow, byKey.rent!.netCashFlow, byKey.vacancy!.netCashFlow)
    );
  });

  it("changes exactly the variable it names", () => {
    // A 10% rent cut on 50 let weeks is $3,250 less rent, less the 7% fee no longer charged on it.
    expect(byKey.rent!.change).toBeCloseTo(-3_250 * 0.93, 8);
    // Two more vacant weeks removes two weeks' rent net of the same fee.
    expect(byKey.vacancy!.change).toBeCloseTo(-650 * 2 * 0.93, 8);
    // A one-point rate rise changes only the loan side.
    const higher = ownershipCashFlow({ ...OWNERSHIP_EXAMPLE, annualRatePercent: 7 });
    expect(byKey.rate!.change).toBeCloseTo(
      higher.netCashFlow - ownershipCashFlow(OWNERSHIP_EXAMPLE).netCashFlow,
      8
    );
  });

  it("clamps a shift at the input's own ceiling rather than throwing", () => {
    const atCeiling = ownershipScenarios({
      ...OWNERSHIP_EXAMPLE,
      annualRatePercent: 29.5,
      vacancyWeeks: 51,
    });
    expect(atCeiling).toHaveLength(4);
    expect(atCeiling.every((scenario) => Number.isFinite(scenario.netCashFlow))).toBe(true);
  });
});

describe("stated limits and due-diligence sources", () => {
  it("says it is pre-tax and names what is excluded", () => {
    const text = OWNERSHIP_EXCLUSIONS.join(" ");
    expect(text).toContain("pre-tax");
    expect(text).toContain("stamp duty");
    expect(text).toContain("depreciation");
    expect(text).toContain("land tax");
    expect(text).toMatch(/change in the property's value/);
  });

  it("links only https sources, each with what it is and where it applies", () => {
    expect(DUE_DILIGENCE_SOURCES.length).toBeGreaterThan(4);
    for (const source of DUE_DILIGENCE_SOURCES) {
      expect(source.url.startsWith("https://")).toBe(true);
      expect(source.what.length).toBeGreaterThan(20);
      expect(source.scope.length).toBeGreaterThan(0);
    }
  });

  it("marks the climate map as modelling rather than a government record", () => {
    const climate = DUE_DILIGENCE_SOURCES.find((source) => source.url.includes("climatecouncil"))!;
    expect(climate.scope).toContain("suburb level");
    expect(climate.what).toContain("not a government record");
  });
});
