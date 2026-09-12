import { LOCAL_SOURCES, type LocalSourceKey } from "../../shared/localData";
import { fetchSource, sourceLinks } from "./fetch";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const RENT_CATALOGUES = {
  "sa-bond-rents":
    "https://data.sa.gov.au/data/api/3/action/package_show?id=private-rent-report",
  "tas-bond-rents":
    "https://data.gov.au/data/api/3/action/package_search?fq=organization:department-of-justice-tasmania&q=rental-bond-and-rental-data&rows=100",
};
export function selectRentResource(
  source: LocalSourceKey,
  body: string,
  now: Date,
) {
  const candidates: { url: string; period: string }[] = [];
  if (source === "wa-bond-rents") {
    if (!/CC BY 4\.0/.test(body))
      throw new Error("WA rental licence needs review");
    for (const url of sourceLinks(body, LOCAL_SOURCES[source].url, source)) {
      const m = url.match(
        /\/RentalBondsWA\/wa-rental-bond-([a-z]{3})(\d{4})\.zip$/i,
      );
      if (!m) continue;
      const month =
        MONTHS.findIndex((v) => v.slice(0, 3) === m[1]!.toLowerCase()) + 1;
      if (month)
        candidates.push({
          url,
          period: `${m[2]}-${String(month).padStart(2, "0")}`,
        });
    }
  } else {
    const json = JSON.parse(body);
    if (json.success !== true) throw new Error("Rental catalogue failed");
    const datasets =
      source === "sa-bond-rents" ? [json.result] : json.result.results;
    if (
      !Array.isArray(datasets) ||
      (source === "tas-bond-rents" && json.result.count > datasets.length)
    )
      throw new Error("Rental catalogue is incomplete");
    for (const d of datasets) {
      if (
        source === "tas-bond-rents" &&
        (d.organization?.name !== "department-of-justice-tasmania" ||
          !/^rental-bond-and-rental-data(?:-|$)/.test(d.name))
      )
        continue;
      if (source === "sa-bond-rents" && d.name !== "private-rent-report")
        throw new Error("Wrong SA rental dataset");
      if (!["cc-by", "cc-by-4.0"].includes(d.license_id)) continue;
      for (const r of d.resources ?? []) {
        if (typeof r.url !== "string") continue;
        const m =
          source === "sa-bond-rents"
            ? r.url.match(
                /\/private-rental-report-(\d{4})-(03|06|09|12)\.xlsx$/i,
              )
            : r.url.match(/\/abs-report-([a-z]+)-(\d{4})\.xlsx$/i);
        if (!m) continue;
        const month =
          source === "sa-bond-rents"
            ? Number(m[2])
            : MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
        if (month)
          candidates.push({
            url: r.url,
            period: `${source === "sa-bond-rents" ? m[1] : m[2]}-${String(month).padStart(2, "0")}`,
          });
      }
    }
  }
  const complete = candidates
    .filter((c) => c.period < now.toISOString().slice(0, 7))
    .sort((a, b) => b.period.localeCompare(a.period));
  if (!complete[0])
    throw new Error("No completed, licensed rental resource found");
  if (
    new Set(
      complete
        .filter((c) => c.period === complete[0]!.period)
        .map((c) => c.url),
    ).size !== 1
  )
    throw new Error("Ambiguous rental resources for latest period");
  return complete[0];
}

export async function discoverRentResource(
  source: "sa-bond-rents" | "wa-bond-rents" | "tas-bond-rents",
  now: Date,
  signal?: AbortSignal,
) {
  const url =
    source === "wa-bond-rents"
      ? LOCAL_SOURCES[source].url
      : RENT_CATALOGUES[source];
  return selectRentResource(
    source,
    (await fetchSource(url, source, 2_000_000, signal)).toString("utf8"),
    now,
  );
}
