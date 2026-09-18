/**
 * Ownership cash-flow scenario, pre-tax.
 *
 * This extends the existing repayment illustration rather than replacing it:
 * `monthlyRepayment` is the same function, on the same assumptions. What is
 * added is the rest of the year — rent actually collected, the costs of holding
 * the place, and what is left.
 *
 * Three separations are the whole point of this module, and the tests enforce them:
 *  1. Loan principal is not a cost. A principal repayment leaves the bank
 *     account but moves into equity, so it is subtracted from cash flow and not
 *     from the return on the asset. Both figures are reported.
 *  2. Cash flow is not investment return. Nothing here values the property,
 *     projects a price, or claims a yield on capital.
 *  3. Every input is the reader's. Nothing is a market observation, an offer,
 *     a forecast, or a statement about any actual property.
 *
 * Pre-tax by design. Negative gearing, depreciation, land tax, CGT and every
 * threshold that depends on a person's own circumstances are excluded, because
 * guessing an individual's tax treatment would be the least reliable number on
 * the page.
 */
import { monthlyRepayment } from "./loanRepaymentExample";

export type OwnershipInputs = {
  loanBalance: number;
  annualRatePercent: number;
  termYears: number;
  rentPerWeek: number;
  vacancyWeeks: number;
  managementFeePercent: number;
  councilRatesPerYear: number;
  insurancePerYear: number;
  maintenancePerYear: number;
  strataPerYear: number;
};

export type OwnershipBound = {
  key: keyof OwnershipInputs;
  label: string;
  min: number;
  max: number;
  step: string;
  integer?: boolean;
  /** Shown under the field: what it is, and what it is not. */
  hint: string;
};

export const OWNERSHIP_BOUNDS: OwnershipBound[] = [
  {
    key: "loanBalance",
    label: "Loan balance ($)",
    min: 1,
    max: 100_000_000,
    step: "1",
    hint: "The amount still owing, not the price paid.",
  },
  {
    key: "annualRatePercent",
    label: "Annual interest rate (%)",
    min: 0,
    max: 30,
    step: "0.01",
    hint: "Your loan's rate, not the cash rate.",
  },
  {
    key: "termYears",
    label: "Remaining term (years)",
    min: 1,
    max: 50,
    step: "1",
    integer: true,
    hint: "Whole years left to repay.",
  },
  {
    key: "rentPerWeek",
    label: "Rent when let ($ per week)",
    min: 0,
    max: 100_000,
    step: "1",
    hint: "What a tenant pays, before any fees.",
  },
  {
    key: "vacancyWeeks",
    label: "Vacant weeks per year",
    min: 0,
    max: 52,
    step: "0.5",
    hint: "Weeks with no rent coming in.",
  },
  {
    key: "managementFeePercent",
    label: "Management fee (% of rent)",
    min: 0,
    max: 20,
    step: "0.1",
    hint: "Charged on rent collected. Letting and renewal fees are separate; add them to maintenance.",
  },
  {
    key: "councilRatesPerYear",
    label: "Council rates ($ per year)",
    min: 0,
    max: 1_000_000,
    step: "1",
    hint: "Include water and any fixed service charges you pay.",
  },
  {
    key: "insurancePerYear",
    label: "Insurance ($ per year)",
    min: 0,
    max: 1_000_000,
    step: "1",
    hint: "Building and landlord cover.",
  },
  {
    key: "maintenancePerYear",
    label: "Maintenance and repairs ($ per year)",
    min: 0,
    max: 1_000_000,
    step: "1",
    hint: "An allowance you choose, not a prediction.",
  },
  {
    key: "strataPerYear",
    label: "Strata or body corporate ($ per year)",
    min: 0,
    max: 1_000_000,
    step: "1",
    hint: "Zero for a house. Special levies are not included unless you add them.",
  },
];

export type OwnershipResult = {
  weeksLet: number;
  grossRent: number;
  managementFee: number;
  holdingCosts: number;
  operatingCosts: number;
  /** Rent collected less the costs of holding it. Before any loan payment. */
  netOperatingIncome: number;
  loan: {
    monthlyRepayment: number;
    annualRepayment: number;
    /** First twelve months, amortised month by month. */
    interest: number;
    principalRepaid: number;
  };
  /** What actually leaves or enters the bank account over the year. */
  netCashFlow: number;
  netCashFlowPerWeek: number;
  /** Cash flow with the principal repayment added back: it moved to equity, it was not consumed. */
  netOfInterestOnly: number;
};

export function ownershipInputsValid(
  inputs: Partial<Record<keyof OwnershipInputs, number>>
): boolean {
  return OWNERSHIP_BOUNDS.every(({ key, min, max, integer }) => {
    const value = inputs[key];
    if (value === undefined || !Number.isFinite(value)) return false;
    if (value < min || value > max) return false;
    return !integer || Number.isInteger(value);
  });
}

/** First-year interest and principal, amortised month by month rather than approximated. */
export function firstYearSplit(
  loanBalance: number,
  annualRatePercent: number,
  termYears: number
): { monthly: number; interest: number; principalRepaid: number } {
  const monthly = monthlyRepayment(loanBalance, annualRatePercent, termYears);
  const rate = annualRatePercent / 1200;
  let balance = loanBalance;
  let interest = 0;
  const months = Math.min(12, termYears * 12);
  for (let month = 0; month < months; month++) {
    const charge = balance * rate;
    interest += charge;
    balance = balance + charge - monthly;
  }
  return { monthly, interest, principalRepaid: monthly * months - interest };
}

export function ownershipCashFlow(inputs: OwnershipInputs): OwnershipResult {
  if (!ownershipInputsValid(inputs)) throw new Error("Invalid ownership scenario inputs.");
  const weeksLet = 52 - inputs.vacancyWeeks;
  const grossRent = inputs.rentPerWeek * weeksLet;
  const managementFee = (grossRent * inputs.managementFeePercent) / 100;
  const holdingCosts =
    inputs.councilRatesPerYear +
    inputs.insurancePerYear +
    inputs.maintenancePerYear +
    inputs.strataPerYear;
  const operatingCosts = managementFee + holdingCosts;
  const netOperatingIncome = grossRent - operatingCosts;
  const { monthly, interest, principalRepaid } = firstYearSplit(
    inputs.loanBalance,
    inputs.annualRatePercent,
    inputs.termYears
  );
  const annualRepayment = interest + principalRepaid;
  const netCashFlow = netOperatingIncome - annualRepayment;
  return {
    weeksLet,
    grossRent,
    managementFee,
    holdingCosts,
    operatingCosts,
    netOperatingIncome,
    loan: { monthlyRepayment: monthly, annualRepayment, interest, principalRepaid },
    netCashFlow,
    netCashFlowPerWeek: netCashFlow / 52,
    netOfInterestOnly: netOperatingIncome - interest,
  };
}

export type OwnershipScenario = {
  key: string;
  label: string;
  description: string;
  netCashFlow: number;
  /** Change against the reader's own entries. Negative is worse. */
  change: number;
};

const SCENARIO_SHIFTS = Object.freeze({
  ratePoints: 1,
  rentCutPercent: 10,
  extraVacantWeeks: 2,
});

/**
 * Three single-variable downside shifts and the three together. Deliberately
 * fixed and named rather than reader-chosen: these are "what would it take",
 * not a probability, and none of them is a forecast.
 */
export function ownershipScenarios(inputs: OwnershipInputs): OwnershipScenario[] {
  const baseline = ownershipCashFlow(inputs).netCashFlow;
  const higherRate = Math.min(30, inputs.annualRatePercent + SCENARIO_SHIFTS.ratePoints);
  const lowerRent = inputs.rentPerWeek * (1 - SCENARIO_SHIFTS.rentCutPercent / 100);
  const moreVacancy = Math.min(52, inputs.vacancyWeeks + SCENARIO_SHIFTS.extraVacantWeeks);
  const variants: { key: string; label: string; description: string; inputs: OwnershipInputs }[] = [
    {
      key: "rate",
      label: `Rate ${SCENARIO_SHIFTS.ratePoints} point higher`,
      description: `The same loan at ${higherRate.toFixed(2)}%.`,
      inputs: { ...inputs, annualRatePercent: higherRate },
    },
    {
      key: "rent",
      label: `Rent ${SCENARIO_SHIFTS.rentCutPercent}% lower`,
      description: "The same place re-let for less.",
      inputs: { ...inputs, rentPerWeek: lowerRent },
    },
    {
      key: "vacancy",
      label: `${SCENARIO_SHIFTS.extraVacantWeeks} more vacant weeks`,
      description: "A longer gap between tenants.",
      inputs: { ...inputs, vacancyWeeks: moreVacancy },
    },
    {
      key: "combined",
      label: "All three at once",
      description: "Not a prediction. The point is whether you could carry it.",
      inputs: {
        ...inputs,
        annualRatePercent: higherRate,
        rentPerWeek: lowerRent,
        vacancyWeeks: moreVacancy,
      },
    },
  ];
  return variants.map(({ key, label, description, inputs: variant }) => {
    const netCashFlow = ownershipCashFlow(variant).netCashFlow;
    return { key, label, description, netCashFlow, change: netCashFlow - baseline };
  });
}

/**
 * The worked example on the page. Round, obviously illustrative numbers, chosen
 * so the arithmetic can be followed by hand. Not an observation of any market,
 * property or offer, and not a recommendation.
 */
export const OWNERSHIP_EXAMPLE: OwnershipInputs = Object.freeze({
  loanBalance: 600_000,
  annualRatePercent: 6,
  termYears: 30,
  rentPerWeek: 650,
  vacancyWeeks: 2,
  managementFeePercent: 7,
  councilRatesPerYear: 2_400,
  insurancePerYear: 1_600,
  maintenancePerYear: 2_000,
  strataPerYear: 0,
});

/** What this scenario leaves out, in the order a reader is most likely to be caught by it. */
export const OWNERSHIP_EXCLUSIONS: string[] = [
  "Tax of any kind. This is a pre-tax figure: no negative gearing, no depreciation, no land tax, no capital gains tax, no GST.",
  "Purchase and sale costs: stamp duty, conveyancing, building and pest inspections, lenders mortgage insurance, agent commission.",
  "Any change in the property's value. Cash flow and investment return are different questions and this answers only the first.",
  "Loan fees, offset balances, redraw and extra repayments. The loan is assumed to run at one rate for the whole remaining term.",
  "Letting and lease-renewal fees, advertising, and special strata levies, unless you fold them into the figures above.",
  "Rent that a tenant owes but does not pay, and repairs that arrive all at once rather than as an even annual allowance.",
];

export type DueDiligenceSource = {
  title: string;
  url: string;
  what: string;
  scope: string;
};

/**
 * Records a buyer can check themselves, before contracts. Every link here is an
 * official record or, where noted, a research map that is explicitly not a
 * property-level rating. The Desk does not rate an address, quote insurance, or
 * turn suburb-level modelling into a claim about one property.
 */
export const DUE_DILIGENCE_SOURCES: DueDiligenceSource[] = [
  {
    title: "NSW Planning Portal Spatial Viewer",
    url: "https://www.planningportal.nsw.gov.au/spatialviewer/",
    what: "Zoning, planning controls and mapped constraints for an address or lot.",
    scope: "New South Wales",
  },
  {
    title: "Service NSW · planning certificate (section 10.7)",
    url: "https://www.service.nsw.gov.au/transaction/apply-online-for-a-planning-certificate",
    what: "The council-issued certificate stating the controls and restrictions on the land.",
    scope: "New South Wales",
  },
  {
    title: "NSW Planning Portal · Online DA open data",
    url: "https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api",
    what: "Development applications lodged with councils, including what is proposed nearby.",
    scope: "New South Wales",
  },
  {
    title: "Geoscience Australia · flood",
    url: "https://www.ga.gov.au/scientific-topics/community-safety/hazards/flood",
    what: "The national picture of flood risk information and where the underlying studies sit.",
    scope: "Australia",
  },
  {
    title: "Geoscience Australia · bushfire",
    url: "https://www.ga.gov.au/scientific-topics/community-safety/hazards/bushfire",
    what: "National bushfire hazard information and mapping products.",
    scope: "Australia",
  },
  {
    title: "ABS · Building Activity, Australia",
    url: "https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/latest-release",
    what: "Approvals, commencements and completions — what is actually being built, and where.",
    scope: "Australia",
  },
  {
    title: "ASIC Moneysmart · mortgage calculator",
    url: "https://moneysmart.gov.au/home-loans/mortgage-calculator",
    what: "The regulator's own repayment scenarios, with its assumptions stated.",
    scope: "Australia",
  },
  {
    title: "Climate Council · climate risk map",
    url: "https://www.climatecouncil.org.au/resources/climate-risk-map/",
    what: "Modelled climate risk at suburb and electorate level. Research modelling, not a government record.",
    scope: "Australia · suburb level",
  },
];
