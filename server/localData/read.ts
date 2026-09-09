import {
  LOCAL_SOURCE_KEYS,
  LOCAL_SOURCES,
  STATE_CODES,
  localAreaHref,
  localDatasetIsOlder,
  localPeriodLabel,
  localSampleLabel,
  normaliseArea,
  type LocalArea,
  type LocalDataset,
  type LocalSourceKey,
  type StateCode,
} from "../../shared/localData";
import { readLocalDataset, readLocalDataHealth } from "../db/localData";
import { localSourceAccessDenied } from "../../shared/localSourceAccess";
import { requestedLocalPeriods } from "./requestedPeriods";

const STATE_NAMES = [
  "New South Wales",
  "Victoria",
  "Queensland",
  "South Australia",
  "Western Australia",
  "Tasmania",
  "Northern Territory",
  "Australian Capital Territory",
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundary = (name: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${esc(name)}(?![\\p{L}\\p{N}])`, "iu");
const CAPITALS = new Set([
  "sydney",
  "melbourne",
  "brisbane",
  "adelaide",
  "perth",
  "hobart",
  "darwin",
  "canberra",
]);
export type LocalMatch = {
  area: LocalArea;
  sourceKey: LocalSourceKey;
  period: string;
  resourceUrl: string;
  retrievedAt: string;
  provenance?: "reviewed-release";
  older: boolean;
};
export function matchLocalAreas(
  query: string,
  datasets: LocalDataset[],
  options: {
    state?: StateCode;
    kind?: LocalArea["kind"];
    question?: boolean;
  } = {},
  now = new Date(),
): LocalMatch[] {
  const states = options.state
    ? [options.state]
    : STATE_CODES.filter((state, i) =>
        new RegExp(
          `\\b(?:${state}|${STATE_NAMES[i]})\\b`,
          state === "ACT" ? "u" : "iu",
        ).test(query),
      );
  let place = normaliseArea(query);
  for (const state of states)
    place = place.replace(
      new RegExp(
        `\\b(?:${state}|${STATE_NAMES[STATE_CODES.indexOf(state)]})\\b`,
        "giu",
      ),
      " ",
    );
  place = place
    .replace(/\b(?:postcode|sa2|suburb|lga|council)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[, ]+|[, ]+$/g, "");
  const matches: Array<LocalMatch & { alias: string }> = [];
  for (const data of datasets)
    for (const area of data.areas) {
      if (
        (states.length && !states.includes(area.state)) ||
        (options.kind && options.kind !== area.kind)
      )
        continue;
      const alias = normaliseArea(area.name).replace(
        / \((?:c|s|r|rc|m)\)$/i,
        "",
      );
      if (options.question) {
        if (!boundary(alias).test(query)) continue;
        if (
          area.kind === "postcode" &&
          !new RegExp(`\\bpostcode\\s+${esc(alias)}\\b`, "iu").test(query)
        )
          continue;
        // A capital's namesake SA2/LGA is not the entire metropolitan market.
        if (
          CAPITALS.has(alias) &&
          !/\b(sa2|council|lga|local government|city of|suburb)\b/i.test(query)
        )
          continue;
      } else if (place !== alias && place !== normaliseArea(area.name))
        continue;
      matches.push({
        area,
        sourceKey: data.sourceKey,
        period: data.period,
        resourceUrl: data.resourceUrl,
        retrievedAt: data.retrievedAt,
        ...(data.provenance ? { provenance: data.provenance } : {}),
        older: localDatasetIsOlder(data, now),
        alias,
      });
    }
  return matches
    .filter((match) => {
      if (!options.question) return true;
      if (
        !states.length &&
        matches.some(
          (other) =>
            other.alias === match.alias &&
            other.area.state !== match.area.state,
        )
      )
        return false;
      return !matches.some(
        (other) =>
          other.alias.length > match.alias.length &&
          boundary(match.alias).test(other.alias),
      );
    })
    .sort(
      (a, b) =>
        b.alias.length - a.alias.length || a.area.id.localeCompare(b.area.id),
    )
    .slice(0, 6)
    .map(({ alias: _alias, ...match }) => match);
}

export async function localDatasets(): Promise<LocalDataset[]> {
  const results = await Promise.allSettled(
    LOCAL_SOURCE_KEYS.map(readLocalDataset),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}
export async function getLocalData(
  query: string,
  state?: StateCode,
  kind?: LocalArea["kind"],
) {
  const datasets = await localDatasets();
  return {
    matches: matchLocalAreas(query, datasets, { state, kind }),
    sourcesReady: datasets.map((d) => d.sourceKey),
  };
}
export async function getLocalCoverage() {
  const [datasets, health] = await Promise.all([
    localDatasets(),
    readLocalDataHealth().catch(() => []),
  ]);
  return LOCAL_SOURCE_KEYS.map((sourceKey) => {
    const data = datasets.find((d) => d.sourceKey === sourceKey),
      check = health.find((h) => h.sourceKey === sourceKey);
    return {
      sourceKey,
      label: LOCAL_SOURCES[sourceKey].label,
      cadence: LOCAL_SOURCES[sourceKey].cadence,
      period: data?.period ?? null,
      retrievedAt: data?.retrievedAt ?? null,
      provenance: data?.provenance ?? null,
      checkedAt: check?.checkedAt.toISOString() ?? null,
      error: check?.error ?? null,
      accessPaused: localSourceAccessDenied(check?.error),
      older: data ? localDatasetIsOlder(data, new Date()) : false,
      areas: data?.areas.length ?? 0,
      excludedRows: data?.excludedRows ?? 0,
      states: Object.fromEntries(
        STATE_CODES.map((state) => [
          state,
          data?.areas.filter((a) => a.state === state).length ?? 0,
        ]),
      ),
    };
  });
}

export type FactEvidence = {
  title: string;
  date: string;
  href: string;
  publisher: string;
  sourceUrl: string;
  text: string;
  /** All selected weekly-rent observations are explicitly withheld, not absent. */
  withheldRent?: boolean;
};
export function localFactEvidence(
  match: LocalMatch,
  question = "",
): FactEvidence[] {
  const source = LOCAL_SOURCES[match.sourceKey];
  const requestedPeriods = requestedLocalPeriods(question);
  const beds = question.match(/\b([0-9]+)[ -]?(?:bed|bedroom)/i)?.[1];
  const house = /\bhouses?\b/i.test(question),
    flat = /\b(flats?|units?|apartments?)\b/i.test(question),
    town = /\btownhouses?\b/i.test(question);
  const observations = match.area.observations.filter((o) => {
    if (
      requestedPeriods.length
        ? !requestedPeriods.some((period) => o.period.startsWith(period))
        : o.period !== match.period
    )
      return false;
    if (o.measure !== "weekly-rent") return true;
    if (beds && !new RegExp(`(?:^|\\s)${beds}(?:\\s|$)`).test(o.category))
      return false;
    if (town && !/townhouse/i.test(o.category)) return false;
    if (house && !town && !/^house/i.test(o.category)) return false;
    if (flat && !/flat/i.test(o.category)) return false;
    return true;
  });
  const area = match.area;
  // A source card links to one exact table period. Never mix dates under a
  // citation that opens only one of them. Bound each group independently.
  const periods = [...new Set(observations.map((o) => o.period))]
    .sort()
    .reverse();
  return periods.slice(0, 6).map((period) => {
    const rows = observations.filter((o) => o.period === period).slice(0, 12);
    return {
      title: `${area.name}, ${area.state} (${area.kind}) · ${source.label}`,
      date: period,
      href: localAreaHref(area, period),
      publisher: source.publisher,
      sourceUrl: match.resourceUrl,
      withheldRent: rows.every((o) => o.measure === "weekly-rent" && o.value === null && o.status !== "published"),
      text: [
        `Geography: ${area.name}, ${area.state}; ${area.kind}; ${area.boundaryVersion}. Do not extend these observations to another geographic boundary.`,
        ...rows.map(
          (o) =>
            `${o.measure}; ${o.category}; ${localPeriodLabel(match.sourceKey, o.period, o.measure)}; ${o.value === null ? "withheld: " + o.status : `${o.value} ${o.unit}`}${o.sample === null ? "" : `; ${localSampleLabel(match.sourceKey)}: ${o.sample}`}.`,
        ),
        source.method,
        ...(rows.every((o) => o.value === null)
          ? [
              "The requested values are withheld in this release. No numeric answer is available; do not substitute zero, another category or an older value.",
            ]
          : []),
        ...(match.provenance === "reviewed-release"
          ? [
              "Reviewed import of the stated publisher release. This does not establish that automatic updates are working or that a later release is unavailable.",
            ]
          : []),
        period !== match.period
          ? `Historical reporting period requested; do not describe these observations as current market conditions or the latest stored values. Latest stored release period: ${match.period}; its values are not supplied in this citation. Do not claim that a later release is unavailable.`
          : match.older
            ? "Older reporting period; do not describe as current market conditions."
            : "Latest available in this stored source release.",
        `Retrieved: ${match.retrievedAt}. Retrieval is not publication. ${source.attribution}.`,
      ].join("\n"),
    };
  });
}
