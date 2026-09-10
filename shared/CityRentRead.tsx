import React from "react";
import {
  latestRent,
  rentForPeriod,
  cityRentHref,
  rentCity,
  rentGap,
  rentIsOlder,
  rentPeriod,
  RENT_DATA_URL,
  RENT_SOURCE,
  type CityRents,
} from "./cityRents";

/** One definition and presentation across public HTML, market search and comparison. */
export function CityRentRead({
  data,
  marketA,
  marketB,
  asOf,
  onSource,
  period,
}: {
  data?: CityRents;
  marketA: string;
  marketB?: string;
  asOf: string;
  onSource?: () => void;
  period?: string | null;
}) {
  if (!rentCity(marketA) && (!marketB || !rentCity(marketB))) return null;
  const pinned = period !== undefined && period !== null;
  const validPeriod = !pinned || /^20\d{2}-(0[1-9]|1[0-2])$/.test(period);
  const a = rentForPeriod(data, marketA, period),
    b = marketB ? rentForPeriod(data, marketB, period) : undefined;
  const gap = marketB ? rentGap(a, b, asOf) : null;
  return (
    <section
      id="rental-conditions"
      className="rule-major mt-8 py-6 scroll-mt-6"
      aria-label="Official rental conditions"
    >
      <p className="bs-label-accent">Official rental conditions · ABS</p>
      <h2 className="font-serif text-3xl mt-3">The pace of rent growth.</h2>
      <p className="text-sm mt-3 text-[var(--color-fg-muted)]">
        Annual change in rents actually paid · CPI capital-city series · Original
      </p>
      {pinned && <p className="text-sm mt-3" role="status">
        {validPeriod ? `Requested observation: year to ${rentPeriod(period)}. No other month is substituted.` : "Invalid requested reporting month. Use YYYY-MM; latest figures have not been substituted."}
      </p>}
      <div className={`grid gap-6 mt-6 ${marketB ? "sm:grid-cols-2" : ""}`}>
        {[{ name: marketA, row: a }, ...(marketB ? [{ name: marketB, row: b }] : [])].map(
          ({ name, row }) => (
            <div key={name}>
              <h3 className="font-serif text-2xl">{name}</h3>
              {row ? (
                <>
                  <p
                    className="font-mono tracking-tight mt-3"
                    style={{ fontSize: "clamp(48px, 8vw, 80px)", lineHeight: 1 }}
                  >
                    {row.annualPercent.toFixed(1)}
                    <span className="text-3xl">%</span>
                  </p>
                  <p className="bs-label mt-4">Year to {rentPeriod(row.period)}</p>
                  {data?.observations
                    .filter(
                      (previous) =>
                        previous.city === name &&
                        /^\d{4}-(0[1-9]|1[0-2])$/.test(previous.period) &&
                        Number(row.period.slice(0, 4)) * 12 +
                          Number(row.period.slice(5, 7)) -
                          Number(previous.period.slice(0, 4)) * 12 -
                          Number(previous.period.slice(5, 7)) ===
                          1 &&
                        Number.isFinite(previous.annualPercent) &&
                        ["", "p", "r"].includes(previous.status)
                    )
                    .slice(0, 1)
                    .map((previous) => (
                      <p key={previous.period} className="text-sm mt-3">
                        Previous annual rate: {previous.annualPercent.toFixed(1)}%, year to{" "}
                        {rentPeriod(previous.period)}
                        {previous.status === "r"
                          ? " (revised)"
                          : previous.status === "p"
                            ? " (provisional)"
                            : ""}
                        . A difference between annual rates is not the latest month's rent change.
                      </p>
                    ))}
                  <p className="text-sm mt-2">
                    {pinned && row.period !== latestRent(data, name)?.period
                      ? "Historical observation · not the latest available month"
                      : rentIsOlder(row, asOf)
                      ? "Older observation · more than three months behind"
                      : "Latest available in the retrieved series"}
                    {row.status === "p" ? " · Preliminary" : row.status === "r" ? " · Revised" : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm mt-3 text-[var(--color-fg-muted)]">
                  {rentCity(name)
                    ? pinned ? "The requested month's observation is not available in the retained series. A newer figure has not been substituted." : "Official rent data is temporarily unavailable for this city."
                    : "This series covers capital cities. No regional or suburb estimate is substituted."}
                </p>
              )}
            </div>
          )
        )}
      </div>
      {marketB && (
        <p className="font-serif text-xl mt-6">
          {gap === null
            ? "No current same-period rent gap can be stated."
            : gap === 0
              ? "The annual rent growth rates are equal for this period."
              : `${gap > 0 ? marketA : marketB}'s annual rent growth is ${Math.abs(gap).toFixed(1)} percentage points higher for the same period.`}
        </p>
      )}
      <p className="text-sm leading-6 mt-5 max-w-[80ch] text-[var(--color-fg-muted)]">
        This measures changes in rents paid to private and government landlords. It does not measure
        advertised asking rents, rental yields or vacancy. Faster rent growth alone does not
        establish the stronger investment setup.
      </p>
      {marketB && (
        <p className="text-sm mt-3 text-[var(--color-fg-muted)]">
          This data panel is separate from the dated intelligence brief and its saved or shared
          snapshot.
        </p>
      )}
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <a
          href={RENT_SOURCE}
          onClick={onSource}
          target="_blank"
          rel="noopener noreferrer"
          className="bs-link"
        >
          ABS release & methodology ↗
        </a>
        <a
          href={data?.sourceUrl ?? RENT_DATA_URL}
          onClick={onSource}
          target="_blank"
          rel="noopener noreferrer"
          className="bs-link"
        >
          Source observations ({data?.delivery === "workbook" ? "XLSX" : "CSV"}) ↗
        </a>
      </div>
      <p className="text-xs text-[var(--color-fg-muted)] mt-3">
        {data?.retrievedAt ? `Retrieved ${data.retrievedAt.slice(0, 10)}. ` : ""}
        {data?.delivery === "workbook"
          ? "Read from the published ABS workbook. Revisions may be incorporated in the file without cell-level flags."
          : "The ABS beta API can lag the published release."}{" "}
        The reference month above is the observation date; retrieval is not publication.
      </p>
      {a && !marketB && (
        <a
          href={`/markets?q=${encodeURIComponent(marketA)}&vs=${encodeURIComponent(marketA === "Perth" ? "Brisbane" : "Perth")}`}
          className="bs-btn bs-btn-outline mt-5"
        >
          Compare rental conditions →
        </a>
      )}
      {marketB && (
        <div className="flex flex-wrap gap-4 mt-4">
          {[a, b]
            .filter((row) => row !== undefined)
            .map((row) => (
              <a
                key={row.city}
                href={cityRentHref(row.city, row.period)}
                className="bs-link text-sm"
              >
                Open & share {row.city}'s market file →
              </a>
            ))}
        </div>
      )}
    </section>
  );
}
