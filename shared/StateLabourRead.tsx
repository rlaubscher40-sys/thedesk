import {
  LABOUR_SOURCE,
  LABOUR_STATES,
  labourState,
  readStateLabour,
  type StateLabour,
} from "./stateLabour";

export function StateLabourRead({
  data,
  stateCode,
  asOf,
  period,
}: {
  data?: StateLabour;
  stateCode: string;
  asOf: string;
  period?: string | null;
}) {
  const state = labourState(stateCode);
  if (!state) return null;
  const read = readStateLabour(data, state, asOf, period);
  return (
    <section
      id="state-labour"
      className="rule-hair mt-6 py-6"
      aria-label="State employment context"
    >
      <p className="bs-label-accent">Employment · State context</p>
      <h2 className="font-serif text-3xl mt-3">The labour market in {LABOUR_STATES[state]}.</h2>
      <p className="text-sm mt-3">
        Whole state or territory, not a city or suburb estimate. ABS trend series smooth monthly
        volatility and can be revised.
      </p>
      {read ? (
        <>
          <p className="bs-label mt-4">
            Reporting month {data!.period} · Trend{period ? " · Requested period" : ""}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
            {[
              ["Employed people", read.employedPeople.toLocaleString("en-AU")],
              ["Employment · monthly change", `${read.employmentMonthlyPercent.toFixed(1)}%`],
              ["Unemployment rate", `${read.unemploymentPercent.toFixed(1)}%`],
              ["Participation rate", `${read.participationPercent.toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="bs-label">{label}</p>
                <p className="font-mono text-3xl mt-2">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mt-4">
            Employed people are people with employment, not the number of jobs or vacancies. The
            monthly change is ABS's published percentage, not annual growth. These figures alone do
            not establish a housing price outlook.
          </p>
          <p className="text-sm leading-6 mt-3 text-[var(--color-fg-muted)]">
            Australian Bureau of Statistics · Retrieved {data!.retrievedAt?.slice(0, 10)}; retrieval
            is not publication.
          </p>
        </>
      ) : (
        <p className="text-sm mt-4" role="status">
          {period
            ? `Verified employment figures for requested month ${period} are unavailable here. Another month has not been substituted.`
            : "A current, verified employment table is unavailable. Missing observations are not zero."}
        </p>
      )}
      <a
        className="bs-link text-sm inline-block mt-4"
        href={read ? data!.sourceUrl : LABOUR_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
      >
        ABS labour force source and methodology ↗
      </a>
    </section>
  );
}
