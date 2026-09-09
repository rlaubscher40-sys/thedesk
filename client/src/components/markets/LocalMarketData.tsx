import { trpc } from "@/lib/trpc";
import {
  LOCAL_SOURCES,
  STATE_CODES,
  localPeriodLabel,
  type LocalArea,
  type StateCode,
} from "../../../../shared/localData";

const LABELS: Record<string, string> = {
  population: "Estimated population",
  "population-change": "Annual population change",
  "population-growth": "Annual population growth",
  "natural-increase": "Natural increase",
  "internal-migration": "Net internal migration",
  "overseas-migration": "Net overseas migration",
  "weekly-rent": "Median weekly rent",
};
export function LocalMarketData({
  query,
  state,
  kind,
}: {
  query: string;
  state?: string | null;
  kind?: string | null;
}) {
  const { data, isLoading, isError } = trpc.markets.localData.useQuery(
    {
      query: query.slice(0, 80),
      ...(STATE_CODES.includes(state as StateCode)
        ? { state: state as StateCode }
        : {}),
      ...(["SA2", "postcode", "suburb", "LGA", "state"].includes(kind ?? "")
        ? { kind: kind as LocalArea["kind"] }
        : {}),
    },
    { enabled: query.length >= 2, staleTime: 60_000, retry: 1 },
  );
  const planningQuery = /^(?:city of sydney|sydney council|sydney lga)$/i.test(
    query.trim(),
  );
  const planning = trpc.metrics.planningPilot.useQuery(undefined, {
    enabled: planningQuery,
    staleTime: 60_000,
    retry: false,
  });
  return (
    <section
      id="local-data"
      className="rule-major mt-8 py-6 scroll-mt-6"
      aria-label="Local official data"
    >
      <p className="bs-label-accent">Local official data</p>
      <h2 className="font-serif text-3xl mt-3">
        The numbers behind the place.
      </h2>
      <p className="text-sm mt-3 text-[var(--color-fg-muted)]">
        Geographic boundaries and reporting periods are shown for every source.
        A postcode, suburb and statistical area can cover different places.
      </p>
      {isLoading ? (
        <p className="mt-4" role="status">
          Loading local data…
        </p>
      ) : isError ? (
        <p className="mt-4">
          Local data could not be loaded. Please try again.
        </p>
      ) : !data?.matches.length && !planningQuery ? (
        <p className="mt-4">
          No exact local dataset match for this search yet. Try the published
          area name or a postcode, with a state where needed. Missing coverage
          does not mean a weak market.
        </p>
      ) : null}
      {data?.matches.map((match) => (
        <article
          key={`${match.sourceKey}:${match.area.id}`}
          className="border border-[var(--color-rule)] p-5 mt-5"
        >
          <h3 className="font-serif text-2xl">
            {match.area.name}, {match.area.state}
          </h3>
          <p className="bs-label mt-2">
            {match.area.kind} · {LOCAL_SOURCES[match.sourceKey].label}
          </p>
          <p className="text-sm mt-2">{match.area.boundaryVersion}</p>
          {match.older && (
            <p className="text-sm mt-3 font-semibold">
              Older reporting period — current conditions may differ.
            </p>
          )}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="pr-4 py-2">Measure / category</th>
                  <th className="pr-4 py-2">Value</th>
                  <th className="pr-4 py-2">Period</th>
                  <th className="py-2">
                    {match.sourceKey === "nsw-bond-rents"
                      ? "Valid rents"
                      : match.sourceKey === "qld-bond-rents"
                        ? "Bonds lodged"
                        : "Sample"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {match.area.observations
                  .filter((o) => o.period === match.period)
                  .map((o) => (
                    <tr
                      key={`${o.measure}:${o.category}`}
                      className="border-t border-[var(--color-rule)]"
                    >
                      <td className="py-3 pr-4">
                        {LABELS[o.measure]}
                        {o.measure === "weekly-rent" ? ` · ${o.category}` : ""}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {o.value === null
                          ? o.status === "insufficient-sample"
                            ? "Fewer than 10 valid rents"
                            : "Not published"
                          : o.unit === "AUD/week"
                            ? `$${o.value.toLocaleString("en-AU")} / week`
                            : `${o.value.toLocaleString("en-AU")}${o.unit === "%" ? "%" : " people"}`}
                      </td>
                      <td className="py-3 pr-4">
                        {localPeriodLabel(match.sourceKey, o.period, o.measure)}
                      </td>
                      <td className="py-3">{o.sample ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-6 mt-4">
            {LOCAL_SOURCES[match.sourceKey].method}
          </p>
          <p className="text-xs mt-3 text-[var(--color-fg-muted)]">
            {LOCAL_SOURCES[match.sourceKey].attribution}. Retrieved{" "}
            {match.retrievedAt.slice(0, 10)}.
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <a
              className="bs-link"
              href={LOCAL_SOURCES[match.sourceKey].url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source & methodology ↗
            </a>
            <a
              className="bs-link"
              href={match.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Published workbook ↗
            </a>
          </div>
        </article>
      ))}
      {planningQuery && (
        <article className="border border-[var(--color-rule)] p-5 mt-5">
          <h3 className="font-serif text-2xl">
            City of Sydney council planning
          </h3>
          {planning.data?.snapshot ? (
            <>
              <p className="mt-3">
                {planning.data.snapshot.originalApplications} original
                development applications lodged from{" "}
                {planning.data.snapshot.from} to {planning.data.snapshot.to}.
              </p>
              <p className="mt-2">
                {planning.data.snapshot.modifications} modifications and{" "}
                {planning.data.snapshot.reviews} reviews are counted separately.
              </p>
              <p className="mt-2">
                {planning.data.snapshot.dwellings.reported ?? "No total of"}{" "}
                proposed dwellings reported;{" "}
                {planning.data.snapshot.dwellings.missingApplications}{" "}
                applications omit dwelling counts. Proposed dwellings are not
                approvals or completions.
              </p>
            </>
          ) : (
            <p className="mt-3">
              {planning.isLoading
                ? "Loading the planning snapshot…"
                : "No complete planning snapshot is available."}
            </p>
          )}
          <p className="text-sm mt-3">
            City of Sydney local government area only. This does not cover
            Greater Sydney.
          </p>
          <a
            className="bs-link text-sm inline-block mt-3"
            href="https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api"
            target="_blank"
            rel="noopener noreferrer"
          >
            NSW Planning Portal source ↗
          </a>
        </article>
      )}
    </section>
  );
}
