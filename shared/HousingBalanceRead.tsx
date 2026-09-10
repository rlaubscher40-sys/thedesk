import React from "react";
import { HOUSING_DEPOSIT } from "./housingAffordability";
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
          Why more homes can still leave
          <br />
          affordability under pressure.
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
          When housing supply struggles to keep up with demand, competition for available homes puts
          upward pressure on prices and rents. The Council explicitly identifies weak new supply
          relative to demand as a contributor to price pressure (printed page 21). Our 55,000-home
          calculation measures an additional housing gap, not how much prices rose.
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
      <section className="rule-hair pt-5 mt-7">
        <h2 className="font-serif text-3xl">The deposit moved further away.</h2>
        <p className="font-serif text-2xl mt-4">
          {HOUSING_DEPOSIT.startYears} years in {HOUSING_DEPOSIT.startYear}.{" "}
          {HOUSING_DEPOSIT.endYears} years in {HOUSING_DEPOSIT.endYear}.
        </p>
        <p className="text-base leading-7 mt-4">
          NHSAC reports that the modelled time to save a 20% deposit rose from 9.0 years in 2015 to
          11.2 years in 2025. The measure assumes saving 15% of gross median household income each
          year for a median-priced dwelling. It is a benchmark, not an observed waiting time or a
          required minimum deposit. The extra 2.2 years is derived from those endpoints. The Council
          attributes the deterioration to rising housing costs. This decade-long affordability
          measure is separate from the 18-month housing-flow gap; that gap does not establish the
          cause or size of the deposit change.
        </p>
        <a
          className="bs-link inline-block mt-4"
          href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=14`}
          target="_blank"
          rel="noopener noreferrer"
        >
          2015 and 2025 deposit comparison, printed page 3 →
        </a>
        <br />
        <a
          className="bs-link inline-block mt-3"
          href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=65`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Savings assumption, chart 3.2, printed page 54 →
        </a>
      </section>
      <section className="rule-hair pt-5 mt-7">
        <h2 className="font-serif text-3xl">Why catching up takes time.</h2>
        <p className="text-base leading-7 mt-4">
          High construction costs, shortages of skilled labour and project financing affect whether
          homes can be built profitably. Projects can be delayed or cancelled, and approvals take
          time to become completed homes. The Council discusses these constraints in chapter 2,
          section 2.3. An announcement or approval does not immediately add somewhere to live.
        </p>
        <h2 className="font-serif text-3xl mt-7">Pressure is not a price forecast.</h2>
        <p className="text-base leading-7 mt-4">
          Underlying housing need is different from what buyers can pay. Interest rates, incomes and
          borrowing power influence effective demand. The Council attributes much of 2025's price
          growth to interest rate reductions expanding households' spending capacity. RBA research
          also identifies interest rates, rents and momentum as important influences on housing
          prices. Prices can fall even while housing remains scarce if demand weakens.
        </p>
        <p className="font-serif text-2xl mt-5">
          The takeaway: easing scarcity pressure requires supply to catch up with demand. That means
          delivering homes where they are needed, and delivery takes time.
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
          <a
            className="bs-link"
            href="https://www.rba.gov.au/publications/rdp/2019/2019-01/full.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            RBA: A Model of the Australian Housing Market, 2019 →
          </a>
          <a
            className="bs-link"
            href={`${HOUSING_BALANCE_SNAPSHOT.sourceUrl}#page=41`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Construction costs and supply constraints, chapter 2 →
          </a>
          <a
            className="bs-link"
            href="https://unsplash.com/photos/a-very-tall-building-with-a-crane-on-top-of-it-jzEkzVq3Yp0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Reel archive photograph: Damon Hall, Sydney construction, published December 2019
            (Unsplash License) →
          </a>
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
