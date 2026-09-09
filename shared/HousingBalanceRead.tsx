import React from "react";
import { HOUSING_BALANCE_SNAPSHOT, matchedHousingBalance } from "./housingBalance";

/** The Reel's source destination uses the very same reviewed evidence as its visuals. */
export function HousingBalanceRead() {
  const b = matchedHousingBalance(HOUSING_BALANCE_SNAPSHOT);
  if (!b) return <p role="status">The housing balance evidence is unavailable.</p>;
  const n = (v: number) => v.toLocaleString("en-AU");
  return (
    <article className="max-w-4xl mx-auto pb-12">
      <header className="rule-major pt-5">
        <p className="bs-label-accent">Australia · Supply and demand · Historical read</p>
        <h1 className="font-serif text-4xl sm:text-6xl mt-4 leading-tight">
          {n(b.net)} homes added.
          <br />
          And still behind.
        </h1>
        <p className="font-serif text-xl sm:text-2xl mt-5 leading-relaxed">
          Australia added roughly {n(b.net)} homes net of demolitions while new underlying demand
          was estimated at {n(b.demand)} homes. New supply fell short by about {n(b.shortfall)}.
        </p>
        <p className="bs-label mt-4">{b.period} · 18 months · Report released 30 April 2026</p>
      </header>
      <section aria-label="Matched housing supply and demand" className="mt-8 rule-hair pt-5">
        <h2 className="font-serif text-3xl">The numbers that belong together.</h2>
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rule-hair">
                <th className="py-3 pr-4">Measure</th>
                <th className="py-3 pr-4">Approximate homes</th>
                <th className="py-3">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Completions", b.gross, "Homes finished during the period."],
                ["Net new supply", b.net, "Completions after accounting for demolitions."],
                [
                  "New underlying demand",
                  b.demand,
                  "Additional homes needed, estimated from household formation.",
                ],
                ["Additional gap", b.shortfall, "Estimated new demand minus net new supply."],
              ].map(([label, value, meaning]) => (
                <tr className="rule-hair" key={String(label)}>
                  <th className="py-4 pr-4 font-normal">{label}</th>
                  <td className="py-4 pr-4 font-mono text-xl">{n(Number(value))}</td>
                  <td className="py-4">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-serif text-2xl mt-6">
          About {b.netPer100} net new homes for every 100 additional homes needed.
        </p>
        <p className="text-sm leading-6 mt-3">
          Calculation: {n(b.demand)} minus {n(b.net)} = {n(b.shortfall)}. The ratio is {n(b.net)}{" "}
          divided by {n(b.demand)}, multiplied by 100 and rounded. These are calculations from
          approximate published figures, not exact counts of people or households left without a
          home.
        </p>
      </section>
      <section className="rule-hair pt-5 mt-7">
        <h2 className="font-serif text-3xl">Why it matters.</h2>
        <p className="text-base leading-7 mt-4">
          A large construction total can coexist with housing pressure. Some new construction
          replaces homes that have been demolished, while household formation creates additional
          demand. In this matched period, the net addition did not cover that new demand.
        </p>
        <p className="text-base leading-7 mt-4">
          The Council also links high housing and living costs to adult children staying in the
          parental home longer (printed page 44). This is the report's wider affordability context,
          not a consequence measured by the 55,000-home gap calculation.
        </p>
        <p className="text-base leading-7 mt-4">
          This is the gap added during these 18 months. It is not Australia's total accumulated
          shortage, a homelessness count, or a forecast of prices and rents. The comparison is
          national and cannot tell us the shortfall in Brisbane, Perth or any particular suburb.
        </p>
      </section>
      <section className="rule-hair pt-5 mt-7" aria-label="Source and methodology">
        <h2 className="font-serif text-3xl">Source and definitions.</h2>
        <p className="text-sm leading-6 mt-4">
          Based on National Housing Supply and Affordability Council data, State of the Housing
          System 2026, printed page 21 (PDF page 32). It reports the same national 18-month window
          for completions, net supply and estimated underlying demand. The Housing Accord began on 1
          July 2024, so its first 18 months end on 31 December 2025.
        </p>
        <p className="text-sm leading-6 mt-4">
          Net new supply accounts for dwellings demolished or destroyed. Underlying demand estimates
          additional housing requirements from demographic characteristics and household formation.
          It is not raw population growth, an approvals target or observed buyer enquiries. The
          report's model does not directly measure all previously accumulated unmet housing need.
        </p>
        <p className="text-sm leading-6 mt-4">
          This is a dated extraction checked on 9 September 2026, not a live September 2026 reading.
          A newer report may revise the estimates.
        </p>
        <div className="flex flex-col items-start gap-3 mt-5">
          <a className="bs-link" href={b.source} target="_blank" rel="noopener noreferrer">
            Read the matched source figures, page 21 →
          </a>
          <a
            className="bs-link"
            href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=55`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Affordability and living at home longer, page 44 →
          </a>
          <a
            className="bs-link"
            href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=104`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Definitions, page 93 →
          </a>
          <a
            className="bs-link"
            href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=84`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Model and existing unmet need, page 73 →
          </a>
          <a
            className="bs-link"
            href="https://nhsac.gov.au/reports-and-submissions/state-housing-system-2026"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report publication and downloads →
          </a>
        </div>
      </section>
    </article>
  );
}
