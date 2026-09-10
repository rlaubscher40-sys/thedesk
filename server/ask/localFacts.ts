import {
  RENT_CITIES,
  RENT_SOURCE,
  latestRent,
  rentIsOlder,
  cityRentHref,
} from "../../shared/cityRents";
import {
  NSW_PILOT_COUNCIL,
  NSW_PLANNING_DATASET,
  nswPlanningWindow,
  planningPeriodWindow,
  planningEvidenceHref,
} from "../../shared/nswPlanning";
import { getCityRents } from "../markets/absRents";
import { readPlanningSnapshots } from "../db/planningSnapshots";
import { requestedLocalPeriods } from "../localData/requestedPeriods";
import {
  localDatasets,
  localFactEvidence,
  matchLocalAreas,
  type FactEvidence,
} from "../localData/read";

/** Optional evidence has a smaller budget than Ask. A failed source must not fail the answer.
 * Stored local data and planning reads never initiate external collection. */
export async function retrieveLocalFacts(
  question: string,
): Promise<FactEvidence[]> {
  const requestedPeriods = requestedLocalPeriods(question);
  const rent = /\brent(?:s|al)?\b/i.test(question),
    population = /\b(population|migration|demographic|residents)\b/i.test(
      question,
    );
  const broad = /\b(property|market|outlook|compare)\b/i.test(question);
  const planning =
    /\b(planning|development|applications?|dwellings?|approvals?|supply)\b/i.test(
      question,
    ) && /\b(?:city of sydney|sydney council|sydney lga)\b/i.test(question);
  if (!rent && !population && !broad && !planning) return [];
  const work: Array<Promise<FactEvidence[]>> = [];
  if (rent || population || broad)
    work.push(
      localDatasets().then((datasets) => {
        const groups = matchLocalAreas(
          question,
          datasets.filter(
            (d) =>
              broad ||
              (d.sourceKey === "abs-sa2-population" ? population : rent),
          ),
          { question: true },
        ).map((match) => localFactEvidence(match, question));
        // Give each locality one source before adding its historical periods.
        const facts: FactEvidence[] = [];
        for (let period = 0; period < 6 && facts.length < 6; period++) {
          for (const group of groups) {
            if (group[period] && facts.length < 6) facts.push(group[period]!);
          }
        }
        return facts;
      }),
    );
  const cities = RENT_CITIES.filter((city) =>
    new RegExp(`\\b${city}\\b`, "i").test(question),
  );
  if (
    rent &&
    cities.length &&
    !/\b(suburb|postcode|lga|council|city of|western|eastern|northern|southern|north|south|east|west|weekly|median|vacancy|yield)\b/i.test(
      question,
    )
  ) {
    work.push(
      getCityRents().then((data) =>
        cities.flatMap((city) => {
          if (data.status !== "available" || !data.retrievedAt) return [];
          const latest = latestRent(data, city);
          const rows = requestedPeriods.length
            ? data.observations.filter(row => row.city === city && requestedPeriods.some(period => row.period.startsWith(period)))
                .sort((a, b) => b.period.localeCompare(a.period)).slice(0, 6)
            : latest && !rentIsOlder(latest, new Date().toISOString()) ? [latest] : [];
          return rows.map(row => ({
              title: `${city}: annual CPI rent change`,
              date: row.period,
              href: cityRentHref(city, row.period),
              publisher: "Australian Bureau of Statistics",
              sourceUrl: data.sourceUrl ?? RENT_SOURCE,
              text: `Capital-city CPI rent series for ${city}. Annual change in rents paid: ${row.annualPercent}%, year to ${row.period}. Status: ${row.status || "published"}. ${row.period !== latest?.period || rentIsOlder(row, new Date().toISOString()) ? "Historical observation; do not present as current conditions. " : ""}This is not monthly growth, median weekly rent, advertised rent, vacancy or a suburb observation. Retrieved ${data.retrievedAt}; retrieval is not publication.`,
            }));
        }),
      ),
    );
  }
  if (planning) {
    const currentWindow = nswPlanningWindow(new Date());
    const windows = requestedPeriods.length
      ? [...new Set(requestedPeriods.map(period => period.length >= 7 ? period.slice(0, 7) : currentWindow.from.startsWith(period) ? currentWindow.from.slice(0, 7) : ""))]
          .map(planningPeriodWindow).filter((window): window is {from: string; to: string} => Boolean(window) && window!.to <= currentWindow.to).slice(0, 6)
      : [currentWindow];
    for (const window of windows)
    work.push(
      readPlanningSnapshots(NSW_PILOT_COUNCIL, window.from, window.to).then(
        (rows) => {
          const row = rows[0];
          if (
            !row ||
            !row.completePagination ||
            row.from !== window.from || row.to !== window.to || row.councilName !== NSW_PILOT_COUNCIL ||
            (requestedPeriods.length &&
              !requestedPeriods.some((period) => row.to.startsWith(period))) ||
            (!requestedPeriods.length && Date.now() - Date.parse(row.retrievedAt) > 7 * 86400_000)
          )
            return [];
          return [
            {
              title: "City of Sydney council: development applications",
              date: row.to,
              href: planningEvidenceHref(row),
              publisher: "NSW Planning Portal",
              sourceUrl: NSW_PLANNING_DATASET,
              text: `Council of the City of Sydney LGA only, not Greater Sydney or NSW. Lodged ${row.from} to ${row.to}: ${row.originalApplications} original development applications, ${row.modifications} modifications, ${row.reviews} reviews. Reported proposed dwellings on original applications: ${row.dwellings.reported ?? "unavailable"}; ${row.dwellings.missingApplications} applications omit dwelling counts. Proposed dwellings are not approvals or completions. Complete pagination. ${row.to !== currentWindow.to ? "Historical lodgement period; not current activity. " : ""}Snapshot retrieved ${row.retrievedAt}; revision ${row.fingerprint}.`,
            },
          ];
        },
      ),
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const collected: FactEvidence[] = [];
  try {
    await Promise.race([
      Promise.allSettled(
        work.map((promise) =>
          promise.then((facts) => {
            collected.push(...facts);
          }),
        ),
      ),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 12_000);
      }),
    ]);
    return collected.slice(0, 6);
  } finally {
    clearTimeout(timer);
  }
}
