/** Reviewed illustration, not an observed loan, offer or forecast. Keep this
 * separate from the RBA/APRA observations. Monthly end-of-period principal and
 * interest amortisation, constant nominal annual rate, no fees or extra payments.
 * Assumptions: https://moneysmart.gov.au/home-loans/mortgage-calculator
 */
export function monthlyRepayment(principal: number, annualPercent: number, years: number) {
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    !Number.isFinite(annualPercent) ||
    annualPercent < 0 ||
    annualPercent > 30 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 50
  )
    throw new Error("Invalid repayment illustration inputs.");
  const months = years * 12;
  const rate = annualPercent / 1200;
  return rate === 0
    ? principal / months
    : (principal * rate) / -Math.expm1(-months * Math.log1p(rate));
}

export const LOAN_REPAYMENT_EXAMPLE = Object.freeze({
  principal: 500_000,
  annualPercent: 6,
  years: Object.freeze([30, 25] as const),
  method: "monthly-principal-and-interest-no-fees" as const,
  source: "https://moneysmart.gov.au/home-loans/mortgage-calculator",
});

export const exampleRepayments = () =>
  LOAN_REPAYMENT_EXAMPLE.years.map((years) => {
    const monthly = monthlyRepayment(
      LOAN_REPAYMENT_EXAMPLE.principal,
      LOAN_REPAYMENT_EXAMPLE.annualPercent,
      years
    );
    return { years, monthly, interest: monthly * years * 12 - LOAN_REPAYMENT_EXAMPLE.principal };
  });
export const loanDollars = (value: number) => `$${Math.round(value).toLocaleString("en-AU")}`;
