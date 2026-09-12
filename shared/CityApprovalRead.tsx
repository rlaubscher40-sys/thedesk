import {
  annualApprovals,
  approvalGeography,
  approvalsDataUrl,
  APPROVAL_REGIONS,
  APPROVAL_SOURCE,
  type CityApprovals,
} from "./cityApprovals";
import { rentPeriod } from "./cityRents";

export function CityApprovalRead({
  data,
  cities,
  asOf,
  onSource,
}: {
  data: CityApprovals | undefined;
  cities: string[];
  asOf: string;
  onSource?: () => void;
}) {
  const supported = cities.filter((city) =>
    Object.values(APPROVAL_REGIONS).some((name) => name === city)
  );
  if (!supported.length) return null;
  const reads = supported.map((city) => annualApprovals(data, city, asOf));
  const matched = reads.every(Boolean) && new Set(reads.map((read) => read?.period)).size === 1;
  return (
    <section
      id="housing-approvals"
      className="rule-hair mt-6 py-6 scroll-mt-6"
      aria-label="Housing approvals"
    >
      <p className="bs-label-accent">Housing supply · Approvals</p>
      <h2 className="font-serif text-3xl mt-3">The pipeline before the homes.</h2>
      <p className="text-sm leading-6 mt-3 max-w-[78ch]">
        Dwellings approved over twelve observed months. Approvals are permission to build, not
        starts, completions or homes available today. Larger counts do not establish a stronger
        market.
      </p>
      {matched ? (
        <div className="grid sm:grid-cols-2 gap-6 mt-5">
          {reads.map(
            (read) =>
              read && (
                <div key={read.city}>
                  <p className="bs-label">{approvalGeography(read.city)}</p>
                  <p className="font-mono text-5xl mt-2">{read.total.toLocaleString("en-AU")}</p>
                  <p className="text-sm mt-3">
                    Year to {rentPeriod(read.period)} · original series
                    {read.preliminary ? " · includes preliminary data" : ""}
                    {read.revised ? " · includes revised data" : ""}
                  </p>
                  <a
                    className="bs-link text-sm mt-3 inline-block"
                    href={`/signals?metric=${read.city.toLowerCase()}_approvals_12m`}
                  >
                    Explore this supply signal
                  </a>
                </div>
              )
          )}
        </div>
      ) : (
        <p className="text-sm mt-4" role="status">
          A current read needs twelve consecutive months for each city and a matching end month.
          That evidence is unavailable right now.
        </p>
      )}
      <p className="text-xs leading-5 mt-5 text-[var(--color-fg-muted)]">
        ABS Greater Capital City Statistical Areas; Canberra uses the whole Australian Capital
        Territory. These counts are not adjusted for population or existing housing stock and are
        not seasonally adjusted. They use a different series from CPI rents.
      </p>
      <div className="flex flex-wrap gap-4 text-sm mt-3">
        <a
          href={APPROVAL_SOURCE}
          onClick={onSource}
          className="bs-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          ABS source and methodology
        </a>
        <a
          href={approvalsDataUrl(asOf)}
          onClick={onSource}
          className="bs-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download the source observations
        </a>
      </div>
    </section>
  );
}
