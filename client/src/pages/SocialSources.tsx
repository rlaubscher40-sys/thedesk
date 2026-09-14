import { PublishedPostGallery } from "@/components/PublishedPostGallery";
import { NewLoanRatesRead } from "@shared/NewLoanRatesRead";
import { SocialStart } from "@/components/SocialStart";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { DOCUMENTARY_READING, DOCUMENTARY_SOURCES } from "@shared/documentaryReels";
import { DOCUMENTARY_PHOTOS } from "@shared/documentaryPhotos";
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
  const lending = trpc.markets.newLoanRates.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  return (
    <>
      <h1 className="font-serif text-4xl sm:text-5xl">From the post to the evidence.</h1>
      <PublishedPostGallery />
      <SocialStart />
      <section
        id="documentary-stories"
        className="rule-major py-6 scroll-mt-6"
        aria-label="Australian property documentary sources"
      >
        <p className="text-xs uppercase tracking-widest">The Deal / Property Empires</p>
        <h2 className="font-serif text-3xl mt-2">
          The people and decisions behind Australian property.
        </h2>
        <p className="mt-3 text-sm leading-6">
          Historical stories with sources you can read for free. Company accounts and personal
          recollections are identified; The Desk's interpretation is labelled in the Reel.
        </p>
        {DOCUMENTARY_READING.map((episode) => (
          <article
            key={episode.id}
            id={episode.id}
            className="border-t border-[var(--color-border)] mt-6 pt-5 scroll-mt-6"
          >
            <p className="text-xs uppercase tracking-widest">{episode.series}</p>
            <h3 className="font-serif text-2xl mt-2">{episode.title}</h3>
            <p className="mt-3 text-sm leading-6">{episode.meaning}</p>
            <p className="mt-2 text-sm leading-6">{episode.limitation}</p>
            <ul className="mt-4 space-y-4">
              {episode.sources.map((id) => {
                const source = DOCUMENTARY_SOURCES[id];
                return (
                  <li key={id} className="text-sm leading-6">
                    <a
                      href={source.url}
                      className="bs-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                    </a>
                    <p>
                      {source.publisher} · {source.published}
                    </p>
                    <p>{source.context}</p>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
        <details className="border-t border-[var(--color-border)] mt-6 pt-5">
          <summary className="cursor-pointer font-serif text-xl">
            Archive photographs and credits
          </summary>
          <p className="mt-3 text-sm leading-6">
            These are animated still photographs. Each image shows its stated date, not footage of
            the historical event being narrated.
          </p>
          <ul className="mt-4 space-y-5">
            {Object.values(DOCUMENTARY_PHOTOS).map((photo) => (
              <li key={photo.asset} className="text-sm leading-6">
                <a
                  href={photo.source}
                  className="bs-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {photo.credit}
                </a>
                <p>{photo.purpose}</p>
                <p>{photo.changes}</p>
                {"archive" in photo && (
                  <p>
                    <a
                      href={photo.archive}
                      className="bs-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Kyoto University Library archive
                    </a>
                  </p>
                )}
                <a
                  href={photo.licence}
                  className="bs-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Licence and reuse terms
                </a>
              </li>
            ))}
            <li className="text-sm leading-6">
              The Grollo films also use an{" "}
              <a
                className="bs-link"
                href="https://www.pexels.com/video/australian-money-855198/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Australian-money illustration by Pixabay via Pexels
              </a>
              . This does not depict the family's finances.{" "}
              <a
                className="bs-link"
                href="https://www.pexels.com/license/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pexels licence
              </a>
              .
            </li>
          </ul>
        </details>
      </section>
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
      <NewLoanRatesRead rates={lending.data ?? []} loading={lending.isLoading} />
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
