import { useState } from "react";
import { loanDollars } from "@shared/loanRepaymentExample";
import {
  DUE_DILIGENCE_SOURCES,
  OWNERSHIP_BOUNDS,
  OWNERSHIP_EXAMPLE,
  OWNERSHIP_EXCLUSIONS,
  ownershipCashFlow,
  ownershipInputsValid,
  ownershipScenarios,
  type OwnershipInputs,
} from "@shared/ownershipCashFlow";

const EXAMPLE_TEXT = Object.fromEntries(
  Object.entries(OWNERSHIP_EXAMPLE).map(([key, value]) => [key, String(value)])
) as Record<keyof OwnershipInputs, string>;

function signedDollars(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "$0";
  return `${rounded < 0 ? "−" : "+"}${loanDollars(Math.abs(value))}`;
}

export function OwnershipScenario() {
  const [values, setValues] = useState(EXAMPLE_TEXT);
  const numbers = Object.fromEntries(
    OWNERSHIP_BOUNDS.map(({ key }) => [
      key,
      values[key].trim() === "" ? Number.NaN : Number(values[key]),
    ])
  ) as OwnershipInputs;
  const valid = ownershipInputsValid(numbers);
  const result = valid ? ownershipCashFlow(numbers) : null;
  const scenarios = valid ? ownershipScenarios(numbers) : [];

  return (
    <section aria-labelledby="ownership-title" className="mt-12 rule-major pt-7">
      <p className="bs-label-accent">Hypothetical ownership scenario · Pre-tax</p>
      <h2 id="ownership-title" className="font-serif text-3xl font-bold mt-3">
        What would a year of owning it cost?
      </h2>
      <p
        id="ownership-help"
        className="mt-3 max-w-3xl leading-relaxed text-[var(--color-fg-muted)]"
      >
        Every figure below is one you type. None of them is a market observation, an offer, a
        forecast, or a statement about any actual property. The starting numbers are a worked
        example so the arithmetic can be followed by hand. Your entries stay on this page.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {OWNERSHIP_BOUNDS.map(({ key, label, hint, min, max, step }) => (
          <label key={key} className="block text-sm font-semibold">
            {label}
            <input
              type="number"
              inputMode="decimal"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              aria-describedby={`ownership-help ownership-hint-${key} ownership-result`}
              className="mt-2 block w-full min-h-12 border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] px-3 py-2 rounded-none"
              onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            />
            <span
              id={`ownership-hint-${key}`}
              className="mt-2 block font-normal text-[var(--color-fg-muted)]"
            >
              {hint}
            </span>
          </label>
        ))}
      </div>

      <div
        id="ownership-result"
        role="status"
        aria-live="polite"
        className="mt-7 py-6 rule-hair rule-hair-b"
      >
        {result ? (
          <>
            <dl className="grid sm:grid-cols-3 gap-6">
              <div>
                <dt className="bs-label">Rent collected</dt>
                <dd className="font-serif text-3xl font-bold mt-2">
                  {loanDollars(result.grossRent)}
                </dd>
                <dd className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {result.weeksLet} of 52 weeks let
                </dd>
              </div>
              <div>
                <dt className="bs-label">Costs of holding it</dt>
                <dd className="font-serif text-3xl font-bold mt-2">
                  {loanDollars(result.operatingCosts)}
                </dd>
                <dd className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {loanDollars(result.managementFee)} management, {loanDollars(result.holdingCosts)}{" "}
                  rates, insurance, maintenance and strata
                </dd>
              </div>
              <div>
                <dt className="bs-label">Loan repayments</dt>
                <dd className="font-serif text-3xl font-bold mt-2">
                  {loanDollars(result.loan.annualRepayment)}
                </dd>
                <dd className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {loanDollars(result.loan.interest)} interest,{" "}
                  {loanDollars(result.loan.principalRepaid)} principal
                </dd>
              </div>
            </dl>

            <div className="grid sm:grid-cols-2 gap-6 mt-7 rule-hair pt-6">
              <div>
                <dt className="bs-label">Net cash flow for the year</dt>
                <dd className="font-serif text-4xl font-bold mt-2">
                  {signedDollars(result.netCashFlow)}
                </dd>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {signedDollars(result.netCashFlowPerWeek)} a week. This is money in or out of your
                  account, before tax.
                </dd>
              </div>
              <div>
                <dt className="bs-label">With principal added back</dt>
                <dd className="font-serif text-4xl font-bold mt-2">
                  {signedDollars(result.netOfInterestOnly)}
                </dd>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  The {loanDollars(result.loan.principalRepaid)} of principal left your account but
                  moved into equity. It is not a cost of holding the asset — and this is still not a
                  return, because nothing here values the property.
                </dd>
              </div>
            </div>
          </>
        ) : (
          <p className="leading-relaxed">
            Fill in every field within its range to see a result. A loan balance from $1, a whole
            remaining term from 1 to 50 years, a rate from 0% to 30%, vacancy from 0 to 52 weeks and
            a management fee up to 20%. No result is shown while an entry is missing or out of
            range.
          </p>
        )}
      </div>

      {scenarios.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-2xl font-bold">If it went worse</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
            Each row changes one thing and leaves the rest of your entries alone. These are fixed
            what-if shifts, not probabilities and not predictions.
          </p>
          <table className="mt-4 w-full text-left border-collapse">
            <caption className="sr-only">
              Net cash flow under fixed downside shifts, against your own entries
            </caption>
            <thead>
              <tr className="bs-label">
                <th scope="col" className="py-2 pr-4 font-normal">
                  Change
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Net cash flow
                </th>
                <th scope="col" className="py-2 font-normal">
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.key} className="rule-hair align-top">
                  <th scope="row" className="py-3 pr-4 font-semibold">
                    {scenario.label}
                    <span className="block font-normal text-sm text-[var(--color-fg-muted)]">
                      {scenario.description}
                    </span>
                  </th>
                  <td className="py-3 pr-4 font-mono">{signedDollars(scenario.netCashFlow)}</td>
                  <td className="py-3 font-mono">{signedDollars(scenario.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-serif text-2xl font-bold">What this leaves out</h3>
        <ul className="mt-3 max-w-3xl grid gap-2 text-sm leading-relaxed text-[var(--color-fg-muted)] list-disc pl-5">
          {OWNERSHIP_EXCLUSIONS.map((exclusion) => (
            <li key={exclusion}>{exclusion}</li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
          Assumes the rate holds for the whole remaining term with interest calculated monthly, and
          that each cost is spread evenly across the year. Actual lender calculations differ. This
          does not assess borrowing eligibility, affordability or suitability, and it is not
          financial advice.
        </p>
      </div>

      <div className="mt-4">
        <button type="button" className="bs-link min-h-11" onClick={() => setValues(EXAMPLE_TEXT)}>
          Restore the worked example
        </button>
      </div>

      <section aria-labelledby="due-diligence-title" className="mt-10 rule-major pt-7">
        <h3 id="due-diligence-title" className="font-serif text-2xl font-bold">
          Records you can check yourself
        </h3>
        <p className="mt-3 max-w-3xl leading-relaxed text-[var(--color-fg-muted)]">
          The Desk does not rate an address, price a risk or quote insurance. These are the official
          records and public research behind those questions, so you can read the primary document
          rather than a score derived from it.
        </p>
        <ul className="mt-5 grid sm:grid-cols-2 gap-6">
          {DUE_DILIGENCE_SOURCES.map((source) => (
            <li key={source.url}>
              <a
                className="bs-link underline font-semibold"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.title} ↗
              </a>
              <p className="bs-label mt-2">{source.scope}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {source.what}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
          The planning records above are New South Wales, because that is where The Desk's planning
          reporting is checked. Every state publishes an equivalent zoning record and planning
          certificate; The Desk links only to the ones it has checked itself. Suburb-level climate
          modelling describes an area, not a property: it is not a safety rating for one address and
          it is not an insurance assessment.
        </p>
      </section>
    </section>
  );
}
