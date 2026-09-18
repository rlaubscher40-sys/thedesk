import { useState } from "react";
import { monthlyRepayment, loanDollars } from "@shared/loanRepaymentExample";

const EXAMPLE = { balance: "500000", years: "30", rate: "6", comparison: "6.25" };
const INPUTS = [
  { key: "balance", label: "Loan balance ($)", min: 1, max: 100000000, step: "1" },
  { key: "years", label: "Remaining term (years)", min: 1, max: 50, step: "1" },
  { key: "rate", label: "Starting annual rate (%)", min: 0, max: 30, step: "0.01" },
  { key: "comparison", label: "Comparison annual rate (%)", min: 0, max: 30, step: "0.01" },
] as const;

export function LoanRateScenario() {
  const [values, setValues] = useState(EXAMPLE);
  const valid =
    INPUTS.every(
      ({ key, min, max }) =>
        values[key].trim() !== "" &&
        Number.isFinite(Number(values[key])) &&
        Number(values[key]) >= min &&
        Number(values[key]) <= max
    ) && Number.isInteger(Number(values.years));
  const first = valid
    ? monthlyRepayment(Number(values.balance), Number(values.rate), Number(values.years))
    : null;
  const second = valid
    ? monthlyRepayment(Number(values.balance), Number(values.comparison), Number(values.years))
    : null;
  const difference = first !== null && second !== null ? second - first : null;
  return (
    <section aria-labelledby="rate-scenario-title" className="mt-10 rule-major pt-7">
      <p className="bs-label-accent">Try a hypothetical change</p>
      <h2 id="rate-scenario-title" className="font-serif text-3xl font-bold mt-3">
        What changes in the monthly repayment?
      </h2>
      <p
        id="rate-scenario-help"
        className="mt-3 max-w-3xl leading-relaxed text-[var(--color-fg-muted)]"
      >
        Compare two loan rates with the same balance and remaining term. The starting numbers are an
        example, not a current offer or a prediction. Your entries stay on this page.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
        {INPUTS.map(({ key, label, ...bounds }) => (
          <label key={key} className="block text-sm font-semibold">
            {label}
            <input
              type="number"
              inputMode="decimal"
              {...bounds}
              value={values[key]}
              aria-describedby="rate-scenario-help rate-scenario-result"
              className="mt-2 block w-full min-h-12 border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] px-3 py-2 rounded-none"
              onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <div
        id="rate-scenario-result"
        role="status"
        aria-live="polite"
        className="mt-6 py-6 rule-hair rule-hair-b"
      >
        {difference !== null && first !== null && second !== null ? (
          <>
            <dl className="grid sm:grid-cols-3 gap-6">
              {[
                ["Starting repayment", loanDollars(first)],
                ["Comparison repayment", loanDollars(second)],
                [
                  "Monthly difference",
                  `${loanDollars(Math.abs(difference))}${difference > 0 ? " more" : difference < 0 ? " less" : " change"}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="bs-label">{label}</dt>
                  <dd className="font-serif text-3xl font-bold mt-2">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
              Monthly principal-and-interest payments, rounded to the nearest dollar. The difference
              uses unrounded payments.
            </p>
          </>
        ) : (
          <p>
            Enter a balance from $1 to $100,000,000, a whole remaining term from 1 to 50 years, and
            annual rates from 0% to 30%.
          </p>
        )}
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Assumes each annual rate stays constant for the remaining term, with interest calculated
        monthly. Excludes fees, offsets and extra payments. Actual lender calculations can differ.
        This does not assess borrowing eligibility or affordability, and a fixed-rate loan does not
        automatically change when the cash rate moves.
      </p>
      <div className="flex flex-wrap gap-5 mt-4 text-sm">
        <button type="button" className="bs-link min-h-11" onClick={() => setValues(EXAMPLE)}>
          Restore example
        </button>
        <a
          className="bs-link min-h-11 inline-flex items-center"
          href="https://moneysmart.gov.au/home-loans/mortgage-calculator"
          target="_blank"
          rel="noopener noreferrer"
        >
          More loan scenarios at ASIC Moneysmart ↗
        </a>
      </div>
    </section>
  );
}
