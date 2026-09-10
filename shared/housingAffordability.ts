/** Reviewed NHSAC 2026 context, separate from the 18-month housing-flow gap.
 * The measure assumes annual saving of 15% of gross median household income.
 * It is a modelled 20% deposit hurdle, not a minimum deposit or observed wait. */
export const HOUSING_DEPOSIT = Object.freeze({
  scope: "Australia",
  startYear: 2015,
  endYear: 2025,
  startYears: 9,
  endYears: 11.2,
  depositPercent: 20,
  annualSavingPercent: 15,
  sourcePages: [3, 54, 57],
  pdfPages: [14, 65, 68],
  verifiedAt: "2026-09-10",
  sourceSha256: "23ebfc6b1439c5506e3cc607a8f44e34b5b5f310b80fed9f84407a130630eb57",
});
