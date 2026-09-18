import { analyseRentPressure, RENT_PRESSURE_RELEASE as release } from "./rentPressure";
import { cityRentHref, rentPeriod } from "./cityRents";
export function RentPressureRead() {
  const read = analyseRentPressure(release.observations, release.id)!;
  const points = read.rows.flatMap((row) => [row.current.annualPercent, row.prior.annualPercent]);
  const min = Math.min(0, ...points),
    max = Math.max(1, ...points);
  const x = (value: number) => 160 + ((value - min) / (max - min)) * 520;
  return (
    <article className="max-w-5xl mx-auto py-7 px-2 sm:px-6">
      <p className="bs-label-accent">The Desk analysis · Rent pressure monitor · No. 1</p>
      <h1 className="font-serif font-bold text-4xl sm:text-6xl mt-4 leading-tight">
        Is rent growth easing across the capitals?
      </h1>
      <p className="font-serif text-xl sm:text-2xl mt-5 leading-relaxed">
        In July 2026, annual rent growth slowed in just {read.slower} of eight capitals. It
        accelerated in {read.faster} and was unchanged in {read.unchanged}.
      </p>
      <p className="text-sm mt-4 leading-6">
        Published {release.publishedOn} · ABS reference month {rentPeriod(read.period)} · Source
        released {release.sourceReleasedOn}. This is a dated analysis, not a live rent estimate.
      </p>
      <section className="rule-major mt-8 pt-6">
        <h2 className="font-serif text-3xl">A wider gap, not broad relief.</h2>
        <p className="mt-4 leading-7 max-w-[78ch]">
          Melbourne’s annual rate eased from 2.6% to 2.5%. Darwin rose from 5.6% to 6.0%, and Hobart
          from 2.8% to 3.0%. The other five capitals were unchanged at the published precision. All
          eight rates remained positive: this does not show rents falling across the capitals.
        </p>
        <p className="mt-4 leading-7 max-w-[78ch]">
          The highest-to-lowest annual-rate gap widened from {read.priorSpread.toFixed(1)} to{" "}
          {read.spread.toFixed(1)} percentage points. The useful distinction is between slower
          growth and lower rents. A city can have slower rent inflation and still have rising rents.
          These figures cannot identify which city has the cheapest weekly rent.
        </p>
        <figure className="mt-6 rule-hair pt-5">
          <figcaption className="font-serif text-xl">
            Annual rent change, June to July 2026 (%)
          </figcaption>
          <p className="text-sm mt-2">
            Open circle: June · Filled circle: July · Original CPI rents-paid series
          </p>
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Scrollable rent change chart"
            tabIndex={0}
          >
            <svg
              viewBox="0 0 780 435"
              role="img"
              aria-label="Eight capital-city annual rent growth rates in June and July 2026"
              className="w-full min-w-[620px] mt-4"
            >
              {[0, 2, 4, 6].map((tick) => (
                <g key={tick}>
                  <line
                    x1={x(tick)}
                    x2={x(tick)}
                    y1="18"
                    y2="382"
                    stroke="currentColor"
                    opacity="0.15"
                  />
                  <text x={x(tick)} y="415" textAnchor="middle" fill="currentColor" fontSize="17">
                    {tick}%
                  </text>
                </g>
              ))}
              {read.rows.map((row, index) => (
                <g key={row.city}>
                  <text x="4" y={44 + index * 46} fill="currentColor" fontSize="19">
                    {row.city}
                  </text>
                  <line
                    x1={x(row.prior.annualPercent)}
                    x2={x(row.current.annualPercent)}
                    y1={38 + index * 46}
                    y2={38 + index * 46}
                    stroke="var(--color-accent-text)"
                    strokeWidth="4"
                  />
                  <circle
                    cx={x(row.prior.annualPercent)}
                    cy={38 + index * 46}
                    r="8"
                    fill="var(--color-bg)"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx={x(row.current.annualPercent)}
                    cy={38 + index * 46}
                    r="5"
                    fill="var(--color-accent-text)"
                  />
                  <text x="718" y={44 + index * 46} fill="currentColor" fontSize="19">
                    {row.current.annualPercent.toFixed(1)}%
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <p className="text-xs leading-6">
            Source: Australian Bureau of Statistics, CPI Table 11, July 2026 release. Chart and
            calculations: The Desk. CC BY 4.0 attribution; ABS does not endorse this analysis.
          </p>
        </figure>
      </section>
      <section className="mt-8 rule-major pt-6">
        <h2 className="font-serif text-3xl">Reproduce the reading</h2>
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">
              Matched annual rent rates and percentage-point changes
            </caption>
            <thead>
              <tr>
                <th className="py-3">Capital</th>
                <th>June %</th>
                <th>July %</th>
                <th>Change, pp</th>
              </tr>
            </thead>
            <tbody>
              {read.rows.map((row) => (
                <tr key={row.city} className="rule-hair">
                  <th className="py-3 font-normal">
                    <a className="bs-link underline" href={cityRentHref(row.city, read.period)}>
                      {row.city}
                    </a>
                  </th>
                  <td>{row.prior.annualPercent.toFixed(1)}</td>
                  <td>{row.current.annualPercent.toFixed(1)}</td>
                  <td>
                    {row.change > 0 ? "+" : ""}
                    {row.change.toFixed(1)}
                    {row.current.status ? ` (${row.current.status})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 leading-7">
          For each city: July annual rate minus June annual rate, rounded to one decimal percentage
          point. Count positive, negative and zero differences across all eight cities. Spread =
          maximum annual rate minus minimum annual rate. Each city counts once; this breadth count
          is not a population-weighted national rent index.
        </p>
        <div className="flex flex-wrap gap-4 mt-5">
          <a className="bs-btn bs-btn-outline" href={release.sourceUrl}>
            Original ABS workbook ↗
          </a>
          <a className="bs-btn bs-btn-outline" href="/research/rent-pressure-2026-07.json" download>
            Download inputs and provenance
          </a>
          <a
            className="bs-link min-h-11 inline-flex items-center"
            href="https://github.com/rlaubscher40-sys/thedesk/blob/main/shared/rentPressure.ts"
          >
            Calculation code ↗
          </a>
        </div>
        <p className="mt-4 text-xs break-all">
          Workbook SHA-256: {release.workbookSha256}. Retrieved {release.retrievedAt}.
        </p>
      </section>
      <section className="mt-8 rule-hair pt-6 max-w-[85ch]">
        <h2 className="font-serif text-2xl">What this cannot tell you</h2>
        <p className="mt-3 leading-7">
          These are ABS capital-city CPI boundaries, original annual percentage changes in rents
          paid across the measured rental stock. They are not statewide or suburb observations,
          house-only rents, advertised asking rents, yields or dollar medians. Changes between
          overlapping annual rates do not measure the change in rent during July. Rounded published
          values can hide smaller differences. No cause, future return or individual lease outcome
          is inferred.
        </p>
        <p className="mt-3 leading-7">
          The subgroup and expenditure-class series were matched by their pinned ABS series IDs and
          required to agree. Missing, duplicated or incompatible observations withhold the
          eight-city calculation. The preserved edition does not silently change if ABS later
          revises its source.
        </p>
        <a
          className="bs-link underline inline-block mt-4"
          href="https://www.abs.gov.au/website-privacy-copyright-and-disclaimer"
        >
          ABS copyright and reuse terms ↗
        </a>
      </section>
      <section className="mt-8 rule-hair pt-6">
        <h2 className="font-serif text-2xl">Update history</h2>
        {release.history.map((entry) => (
          <p key={entry.date} className="mt-3 leading-7">
            <time>{entry.date}</time>: {entry.note}
          </p>
        ))}
        <p className="mt-3 leading-7">
          This recurring question is updated when a new compatible ABS release is checked. No weekly
          release is promised. Revisions receive a dated entry and retain the previous inputs.
        </p>
      </section>
      <nav className="mt-8 flex flex-wrap gap-4">
        <a className="bs-btn bs-btn-solid" href="/signals#data-rents">
          Explore current rent observations →
        </a>
        <a className="bs-btn bs-btn-outline" href="/guides/rents">
          Understand rent measures →
        </a>
      </nav>
    </article>
  );
}
