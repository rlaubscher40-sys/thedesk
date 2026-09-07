import React from "react";
import { CityRentRead } from "./CityRentRead";
import { latestRent, rentGap, rentPeriod, type CityRents } from "./cityRents";

export const PUBLIC_COMPARISON_PATH = "/markets/compare/brisbane-vs-perth";
export const PUBLIC_COMPARISON_TITLE = "Brisbane vs Perth: what the rent evidence says";

export function comparisonRentSummary(data: CityRents | undefined, asOf: string): string {
  const a = latestRent(data, "Brisbane"),
    b = latestRent(data, "Perth");
  const gap = rentGap(a, b, asOf);
  if (gap === null || !a || !b)
    return "A current, same-period rental comparison is unavailable. Check the observations below; a data gap is not a signal to favour either market.";
  const figures = `In the year to ${rentPeriod(a.period)}, annual growth in rents actually paid was ${a.annualPercent.toFixed(1)}% in Brisbane and ${b.annualPercent.toFixed(1)}% in Perth.`;
  return `${figures} ${gap === 0 ? "The growth rates were equal." : `${gap > 0 ? "Brisbane" : "Perth"} was ${Math.abs(gap).toFixed(1)} percentage points higher.`} This tells us about rent growth, not which city is the better investment.`;
}

/** Same sourced read for browsers and server-rendered link previews; no generated claims. */
export function PublicComparisonRead({
  data,
  asOf,
  onSource,
}: {
  data?: CityRents;
  asOf: string;
  onSource?: () => void;
}) {
  return (
    <article className="min-w-0 pb-8">
      <nav aria-label="Breadcrumb" className="bs-label mb-5">
        <a href="/markets" className="bs-link">
          Markets
        </a>{" "}
        / Brisbane vs Perth
      </nav>
      <header className="rule-major pt-5">
        <p className="bs-label-accent">Market vs Market · Free evidence read</p>
        <h1
          className="font-serif font-bold mt-4"
          style={{ fontSize: "clamp(44px, 9vw, 96px)", lineHeight: 0.98, letterSpacing: "-0.04em" }}
        >
          Brisbane vs Perth.
        </h1>
        <p className="font-serif text-2xl sm:text-3xl mt-5 max-w-[38ch]">
          Where are rents growing faster—and what does that leave unanswered?
        </p>
        <p className="bs-label mt-5">No account or question allowance needed</p>
      </header>
      <section className="rule-hair mt-7 pt-6" aria-label="The short read">
        <p className="bs-label-accent">The short read</p>
        <p className="font-serif text-xl sm:text-2xl leading-relaxed mt-3 max-w-[65ch]">
          {comparisonRentSummary(data, asOf)}
        </p>
      </section>
      <CityRentRead
        data={data}
        marketA="Brisbane"
        marketB="Perth"
        asOf={asOf}
        standalone
        onSource={onSource}
      />
      <section className="rule-major py-6" aria-label="Evidence still needed">
        <p className="bs-label-accent">What this comparison cannot settle</p>
        <h2 className="font-serif text-3xl mt-3">The rest of the investment case is still open.</h2>
        <p className="text-base leading-7 mt-3 max-w-[70ch] text-[var(--color-fg-muted)]">
          This page currently compares one official rental measure. These measures still need
          comparable city boundaries, observation periods and definitions before we can put numbers
          beside them here.
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-8 mt-5">
          {[
            [
              "Rental availability & yield",
              "Vacancy, asking rents and yields are not measured by this CPI series.",
            ],
            [
              "Housing supply",
              "We still need comparable approvals, completions and dwelling-stock evidence for both cities.",
            ],
            [
              "Population & demand",
              "We still need population growth and migration measured over matching city boundaries and periods.",
            ],
            [
              "Purchase prices & momentum",
              "We still need like-for-like prices and growth, with dwelling type and measurement method stated.",
            ],
          ].map(([title, detail]) => (
            <div key={title} className="rule-hair py-5">
              <dt className="font-serif text-2xl">{title}</dt>
              <dd className="text-sm leading-6 mt-2 text-[var(--color-fg-muted)]">{detail}</dd>
            </div>
          ))}
        </dl>
        <p className="font-serif text-xl leading-7 mt-4">
          What would change the read: evidence that rental pressure is easing or intensifying, set
          against new supply, demand and the price paid to enter each market.
        </p>
      </section>
      <section className="rule-hair py-5">
        <h2 className="bs-label-accent">Follow the evidence</h2>
        <div className="flex flex-wrap gap-4 mt-4">
          <a href="/markets/brisbane" className="bs-btn bs-btn-outline">
            Brisbane market file →
          </a>
          <a href="/markets/perth" className="bs-btn bs-btn-outline">
            Perth market file →
          </a>
          <a href="/markets?q=Brisbane&vs=Perth" className="bs-link text-sm self-center">
            Request a deeper comparison →
          </a>
        </div>
        <p className="text-xs text-[var(--color-fg-muted)] mt-3">
          The deeper comparison uses your intelligence allowance and can only answer from the
          reporting available.
        </p>
      </section>
    </article>
  );
}
