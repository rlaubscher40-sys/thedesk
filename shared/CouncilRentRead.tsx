import {
  LOCAL_SOURCES,
  localAreaHref,
  localPeriodLabel,
  localSampleLabel,
  type LocalArea,
} from "./localData";

export type CouncilRents = {
  area: LocalArea;
  period: string;
  resourceUrl: string;
  retrievedAt: string;
  older: boolean;
};

/** Exact RTA council boundary only; never substitute the namesake suburb. */
export function councilRentObservations(data?: CouncilRents) {
  if (!data || data.area.kind !== "LGA" || data.area.state !== "QLD") return [];
  return data.area.observations.filter(
    (o) => o.measure === "weekly-rent" && o.period === data.period && o.unit === "AUD/week"
  );
}

export function CouncilRentRead({ data }: { data?: CouncilRents }) {
  if (!data) return null;
  const source = LOCAL_SOURCES["qld-bond-rents"];
  const observations = councilRentObservations(data);
  if (!observations.length) return null;
  return (
    <section
      id="council-rents"
      aria-label="Council-area rental bonds"
      className="rule-hair mt-6 py-6"
    >
      <p className="bs-label-accent">Local rents · Council area</p>
      <h2 className="font-serif text-3xl mt-3">New-tenancy rents in {data.area.name}.</h2>
      <p className="text-sm leading-6 mt-3">
        {data.area.kind} · {data.area.boundaryVersion}. This is the council area, not the namesake
        suburb.
      </p>
      <p className="bs-label mt-3">
        {localPeriodLabel("qld-bond-rents", data.period, "weekly-rent")}
      </p>
      {data.older && (
        <p className="text-sm mt-3 font-semibold">
          Older reporting period. Current conditions may differ.
        </p>
      )}
      <div
        role="region"
        aria-label="Council rent table"
        tabIndex={0}
        className="overflow-x-auto mt-4"
      >
        <table className="w-full text-sm text-left">
          <caption className="sr-only">{data.area.name} new-tenancy weekly rents</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-4 py-2">
                Source category
              </th>
              <th scope="col" className="pr-4 py-2">
                Median AUD/week
              </th>
              <th scope="col" className="py-2">
                {localSampleLabel("qld-bond-rents")}
              </th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o) => (
              <tr key={o.category} className="border-t border-[var(--color-rule)]">
                <th scope="row" className="pr-4 py-3 font-normal">
                  {o.category}
                </th>
                <td className="pr-4 py-3 font-mono">
                  {o.status === "published" && o.value !== null && Number.isFinite(o.value)
                    ? `$${o.value.toLocaleString("en-AU")}`
                    : "Not published"}
                </td>
                <td className="py-3 font-mono">
                  {o.sample === null ? "Not supplied" : o.sample.toLocaleString("en-AU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm leading-6 mt-4 max-w-[85ch] text-[var(--color-fg-muted)]">
        {source.method} Categories retain the publisher's labels: House 3 means a three-bedroom
        house.
      </p>
      <p className="text-sm leading-6 mt-3">
        {source.attribution}. Retrieved {data.retrievedAt.slice(0, 10)}; retrieval is not
        publication.
      </p>
      <div className="flex flex-wrap gap-3 mt-3">
        <a
          href={data.resourceUrl}
          className="bs-link bs-period-link text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          RTA source workbook ↗
        </a>
        <a href={localAreaHref(data.area, data.period)} className="bs-link bs-period-link text-sm">
          Open this council and reporting period
        </a>
      </div>
    </section>
  );
}
