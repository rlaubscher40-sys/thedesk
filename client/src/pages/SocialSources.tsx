import { SocialStart } from "@/components/SocialStart";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  RENT_CITIES,
  RENT_SOURCE,
  RENT_DATA_URL,
  latestRent,
  rentPeriod,
  rentIsOlder,
} from "@shared/cityRents";
export default function SocialSources() {
  useDocumentTitle("Reel sources and property evidence");
  const rents = trpc.markets.rentalConditions.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  return (
    <>
      <h1 className="font-serif text-4xl sm:text-5xl">From the post to the evidence.</h1>
      <SocialStart />
      <section
        id="capital-rents"
        className="rule-major py-6 scroll-mt-6"
        aria-label="Eight capital-city rents"
      >
        <h2 className="font-serif text-3xl">Eight capitals. Annual rent changes.</h2>
        <p className="mt-3 text-sm leading-6">
          ABS CPI rents actually paid, original capital-city series. Not dollar rents, rental
          yields, state estimates or a national average.
        </p>
        {rents.isLoading ? (
          <p role="status" className="mt-4">
            Loading the source observations…
          </p>
        ) : rents.isError ? (
          <p role="alert" className="mt-4">
            The source could not be loaded.{" "}
            <button onClick={() => void rents.refetch()} className="bs-link">
              Try again
            </button>
          </p>
        ) : (
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="py-3">Capital</th>
                  <th>Annual change</th>
                  <th>Year to</th>
                </tr>
              </thead>
              <tbody>
                {RENT_CITIES.map((city) => {
                  const row = latestRent(rents.data, city);
                  return (
                    <tr key={city} className="border-t border-[var(--color-border)]">
                      <th className="py-4 font-normal">
                        <a
                          href={`/markets/${city.toLowerCase()}#rental-conditions`}
                          className="bs-link"
                          onClick={() => trackEvent("social_open", "social")}
                        >
                          {city}
                        </a>
                      </th>
                      <td>{row ? `${row.annualPercent.toFixed(1)}%` : "Unavailable"}</td>
                      <td>
                        {row ? (
                          <>
                            {rentPeriod(row.period)}
                            {rentIsOlder(row, new Date().toISOString()) ? " · Older" : ""}
                            {row.status === "p"
                              ? " · Provisional"
                              : row.status === "r"
                                ? " · Revised"
                                : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs mt-4">
          Compare only matching reference months. Retrieval is not publication; figures can be
          revised.
        </p>
        <div className="flex flex-wrap gap-4 mt-4">
          <a
            href={RENT_SOURCE}
            className="bs-link"
            onClick={() => trackEvent("market_file_source", "social")}
          >
            ABS release and methodology
          </a>
          <a
            href={RENT_DATA_URL}
            className="bs-link"
            onClick={() => trackEvent("market_file_source", "social")}
          >
            Source observations
          </a>
        </div>
      </section>
      <SubscribeBand
        source="social-sources"
        kicker="Keep reading · free daily email"
        headline="Understand the next property headline."
        blurb="The national daily briefing, not personalised advice or a suburb alert. Confirm your email to subscribe."
        showHeadshot={false}
      />
    </>
  );
}
