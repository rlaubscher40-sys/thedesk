import React from "react";

/** Public reading companion uses the same unrounded F6 observations as the Reel. */
export function NewLoanRatesRead({
  rates,
  loading = false,
}: {
  rates: Array<{ seriesId: string; rate: number; period: Date; publicationDate: Date }>;
  loading?: boolean;
}) {
  const names: Record<string, string> = { FLRHOFTA: "Owner-occupiers", FLRHIFTA: "Investors" };
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return (
    <section
      id="new-loan-rates"
      className="rule-major py-6 scroll-mt-6"
      aria-label="New home-loan rates"
    >
      <p className="bs-label-accent">Borrowing costs · RBA / APRA</p>
      <h2 className="font-serif text-3xl mt-2">New home-loan rates.</h2>
      <p className="text-sm mt-3 leading-6">
        Average annual interest rates on new housing loans funded during the month, across all
        institutions. Includes fixed and variable rates. These are not personal offers or the cash
        rate.
      </p>
      {loading ? (
        <p className="mt-4" role="status">
          Loading the source observations…
        </p>
      ) : rates.length !== 2 ? (
        <p className="mt-4" role="status">
          Current matching observations are unavailable.
        </p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="py-3">Borrower</th>
                <th>Rate per year</th>
                <th>Loans funded in</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.seriesId} className="border-t border-[var(--color-border)]">
                  <th className="py-4 font-normal">{names[r.seriesId]}</th>
                  <td>{r.rate.toFixed(1)}%</td>
                  <td>{date(r.period)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm leading-6 mt-4">
        Borrower and loan mixes differ, so the difference between these averages is not a
        like-for-like price premium. Compare rates, fees, repayments and loan terms. A comparison
        rate includes interest and most fees, using a specified loan amount and term.
      </p>
      <p className="text-xs mt-3">
        Original monthly series FLRHOFTA and FLRHIFTA. Rates shown to one decimal place. Figures can
        be revised. Match the reference period shown in the post; this page updates with the source.
      </p>
      <div className="flex flex-wrap gap-4 mt-4">
        <a className="bs-link" href="https://www.rba.gov.au/statistics/interest-rates/">
          RBA lending rates and definitions
        </a>
        <a className="bs-link" href="https://www.rba.gov.au/statistics/tables/csv/f6-data.csv">
          F6 source observations
        </a>
        <a className="bs-link" href="https://moneysmart.gov.au/home-loans/choosing-a-home-loan">
          ASIC Moneysmart loan comparison guide
        </a>
      </div>
    </section>
  );
}
