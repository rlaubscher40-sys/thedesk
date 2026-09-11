import React from "react";
import {
  annualStateDemographics,
  DEMOGRAPHIC_SOURCE,
  type StateDemographics,
} from "./stateDemographics";

const people = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 2 });
function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${people.format(value)}`;
}
function quarter(period: string): string {
  const [year, part] = period.split("-Q");
  return `${part === "1" ? "Mar" : part === "2" ? "Jun" : part === "3" ? "Sep" : "Dec"} ${year}`;
}

export function StatePopulationRead({
  data,
  contexts,
  asOf,
}: {
  data: StateDemographics | undefined;
  contexts: Array<{ state: string; market: string }>;
  asOf: string;
}) {
  const reads = contexts.map(({ state, market }) => ({
    state,
    market,
    read: annualStateDemographics(data, state, asOf),
  }));
  return (
    <section id="state-population" className="rule-hair pt-5 mt-5" aria-label="State population and migration context">
      <p className="bs-label-accent">Demand context · State population</p>
      <h2 className="font-serif text-3xl mt-2">Where population changed.</h2>
      <div className="grid sm:grid-cols-2 gap-x-8 mt-4">
        {reads.map(({ state, market, read }) => (
          <div className="rule-hair py-4" key={state}>
            <p className="bs-label">
              {state} context for {market}
            </p>
            {read ? (
              <>
                <p className="font-mono text-4xl mt-2">{compact.format(read.population)}</p>
                <p className="text-sm mt-2">
                  Population · {signed(read.annualChange)} over the year
                  {read.annualPercent === null ? "" : ` (${read.annualPercent.toFixed(1)}%)`}
                </p>
                <dl className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <dt className="bs-label">Net interstate</dt>
                    <dd className="font-mono text-xl mt-1">{signed(read.netInternalMigration)}</dd>
                  </div>
                  <div>
                    <dt className="bs-label">Net overseas</dt>
                    <dd className="font-mono text-xl mt-1">{signed(read.netOverseasMigration)}</dd>
                  </div>
                </dl>
                <p className="text-xs mt-3 text-[var(--color-fg-muted)]">
                  Year to {quarter(read.period)} · quarterly components
                  {read.preliminary ? " · includes preliminary observations" : ""}
                  {read.revised ? " · includes revised observations" : ""}
                </p>
              </>
            ) : (
              <p className="text-sm mt-3" role="status">
                Current matching observations unavailable.
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm leading-6 mt-3 max-w-[85ch] text-[var(--color-fg-muted)]">
        State-level estimated resident population and migration are demand context, not city
        population, housing demand or proof of price pressure. They do not account for household
        size, vacancy, demolitions, completions or the location of new residents.
      </p>
      <a
        className="bs-label bs-link inline-block mt-3"
        href={DEMOGRAPHIC_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
      >
        Source · Australian Bureau of Statistics →
      </a>
    </section>
  );
}
