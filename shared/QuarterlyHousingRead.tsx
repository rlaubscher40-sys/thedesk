import {
  COMPLETION_SOURCE,
  TRANSFER_SOURCE,
  housingPeriod,
  housingHref,
  quarterLabel,
  type HousingTransfers,
  type HousingCompletions,
} from "./quarterlyHousing";
import { labourState, LABOUR_STATES } from "./stateLabour";
const number = (value: number | null) =>
  value === null ? "Unavailable" : value.toLocaleString("en-AU");
const dollars = (value: number | null) => (value === null ? "Unavailable" : `$${number(value)}`);
export function TransferRead({
  data,
  area,
  asOf,
  period,
}: {
  data?: HousingTransfers;
  area: string;
  asOf: string;
  period?: string | null;
}) {
  const selected = housingPeriod(data, asOf, period);
  const row = selected
    ? data?.observations.find((r) => r.area === area && r.period === selected)
    : undefined;
  return (
    <section id="transfers" aria-label="Sale prices and transfers" className="rule-hair mt-6 py-6">
      <p className="bs-label-accent">Prices · Recorded sales</p>
      <h2 className="font-serif text-3xl mt-3">Sale medians in {area}.</h2>
      <p className="text-sm mt-3">
        Established houses and attached dwellings are separate segments. Published ABS areas are not
        suburb or individual-property valuations.
      </p>
      {row ? (
        <>
          <p className="bs-label mt-4">
            {quarterLabel(row.period)} · Original ·{" "}
            {row.period === data?.period ? "Preliminary" : "Revisions may apply"}
          </p>
          <div
            className="overflow-x-auto mt-4"
            role="region"
            aria-label="Sale-price table"
            tabIndex={0}
          >
            <table className="w-full text-sm text-left">
              <caption className="sr-only">Recorded property transfers in {area}</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-3 pr-4">
                    Property segment
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    Median sale price
                  </th>
                  <th scope="col" className="py-3">
                    Recorded transfers
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="rule-hair">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    Established houses
                  </th>
                  <td className="font-mono pr-4">{dollars(row.houseMedian)}</td>
                  <td className="font-mono">{number(row.houseTransfers)}</td>
                </tr>
                <tr className="rule-hair">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    Attached dwellings
                  </th>
                  <td className="font-mono pr-4">{dollars(row.attachedMedian)}</td>
                  <td className="font-mono">{number(row.attachedTransfers)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-4">
            Unstratified medians reflect the mix of properties sold. A change in the median is not a
            price-growth index. Transfers are recorded sales, not listings. ABS can revise the most
            recent ten quarters; preliminary counts can change substantially.
          </p>
        </>
      ) : (
        <p role="status" className="text-sm mt-4">
          {period
            ? `Verified sales data for ${quarterLabel(period)} is unavailable here. No other period has been substituted.`
            : "A current verified sale-price table is unavailable for this exact area. Missing values are not zero."}
        </p>
      )}
      <p className="text-sm leading-6 mt-3 text-[var(--color-fg-muted)]">
        Australian Bureau of Statistics
        {row && data?.retrievedAt ? ` · Retrieved ${data.retrievedAt.slice(0, 10)}` : ""}
      </p>
      <a
        className="bs-link text-sm inline-block mt-3"
        href={row ? data!.sourceUrl : TRANSFER_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
      >
        ABS sale-price source and methodology ↗
      </a>
      {data?.status === "available" && (
        <nav aria-label="Sales reporting quarters" className="flex flex-wrap gap-3 mt-4 text-sm">
          {data.observations
            .filter((r) => r.area === area)
            .map((r) => (
              <a
                key={r.period}
                className="bs-link bs-period-link"
                aria-current={r.period === selected ? "page" : undefined}
                href={housingHref("transfers", area, r.period)}
              >
                {quarterLabel(r.period)}
              </a>
            ))}
        </nav>
      )}
    </section>
  );
}
export function CompletionRead({
  data,
  stateCode,
  asOf,
  period,
}: {
  data?: HousingCompletions;
  stateCode: string;
  asOf: string;
  period?: string | null;
}) {
  const state = labourState(stateCode);
  if (!state) return null;
  const selected = housingPeriod(data, asOf, period);
  const row = selected
    ? data?.observations.find((r) => r.state === state && r.period === selected)
    : undefined;
  return (
    <section
      id="completions"
      aria-label="State dwelling completions"
      className="rule-hair mt-6 py-6"
    >
      <p className="bs-label-accent">Construction · State context</p>
      <h2 className="font-serif text-3xl mt-3">Dwellings completed in {LABOUR_STATES[state]}.</h2>
      <p className="text-sm mt-3">
        Whole state or territory. These figures do not estimate city or suburb completions.
      </p>
      {row ? (
        <>
          <p className="bs-label mt-4">{quarterLabel(row.period)} · Original · All sectors</p>
          <div className="grid sm:grid-cols-2 gap-5 mt-5">
            <div>
              <p className="bs-label">Completed during quarter</p>
              <p className="font-mono text-3xl mt-2">{number(row.quarter)}</p>
            </div>
            <div>
              <p className="bs-label">Completed over four quarters to this period</p>
              <p className="font-mono text-3xl mt-2">{number(row.year)}</p>
            </div>
          </div>
          <p className="text-sm mt-4">
            Completed dwelling units, all building and work types. The annual figure sums four
            consecutive quarters. Original data are not seasonally adjusted. Completions are not
            approvals, starts, available listings or net additions after demolitions; they cannot be
            divided into a city's differently dated approvals to infer a delivery rate.
          </p>
        </>
      ) : (
        <p role="status" className="text-sm mt-4">
          {period
            ? `Verified completions for ${quarterLabel(period)} are unavailable here. No other period has been substituted.`
            : "A current verified completions table is unavailable. Missing observations are not zero."}
        </p>
      )}
      <p className="text-sm leading-6 mt-3 text-[var(--color-fg-muted)]">
        Australian Bureau of Statistics
        {row && data?.retrievedAt ? ` · Retrieved ${data.retrievedAt.slice(0, 10)}` : ""}
      </p>
      <a
        className="bs-link text-sm inline-block mt-3"
        href={row ? data!.sourceUrl : COMPLETION_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
      >
        ABS completions source and methodology ↗
      </a>
      {data?.status === "available" && (
        <nav
          aria-label="Completions reporting quarters"
          className="flex flex-wrap gap-3 mt-4 text-sm"
        >
          {data.observations
            .filter((r) => r.state === state)
            .map((r) => (
              <a
                key={r.period}
                className="bs-link bs-period-link"
                aria-current={r.period === selected ? "page" : undefined}
                href={housingHref("completions", LABOUR_STATES[state], r.period)}
              >
                {quarterLabel(r.period)}
              </a>
            ))}
        </nav>
      )}
    </section>
  );
}
