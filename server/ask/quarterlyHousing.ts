import { STATE_CODES } from "../../shared/localData";
import { PUBLIC_MARKETS } from "../../shared/marketDirectory";
import { LABOUR_STATES } from "../../shared/stateLabour";
import {
  TRANSFER_AREAS,
  housingPeriod,
  housingHref,
  quarterLabel,
} from "../../shared/quarterlyHousing";
import { getHousingTransfers, getHousingCompletions } from "../markets/absQuarterlyHousing";
import type { FactEvidence } from "../localData/read";
import type { AskContextSource } from "../prompts/ask";

/** Whole-request grammar: an unknown geography, basis, measure or second period
 * prevents a partial table lookup from masquerading as the complete answer. */
export function quarterlyHousingScope(question: string) {
  const completion = /\b(?:completions?|completed)\b/i.test(question);
  const transfer = /\b(?:prices?|medians?|sales?|transfers?)\b/i.test(question);
  if (completion === transfer) return null;
  let rest = question;
  const periods: string[] = [];
  rest = rest.replace(/\b(20\d{2})-Q([1-4])\b/gi, (_, y, q) => {
    periods.push(`${y}-Q${q}`);
    return " ";
  });
  rest = rest.replace(/\b(March|June|September|December) quarter (20\d{2})\b/gi, (_, month, y) => {
    periods.push(
      `${y}-Q${["march", "june", "september", "december"].indexOf(month.toLowerCase()) + 1}`
    );
    return " ";
  });
  if (periods.length > 1) return null;
  const places: string[] = [];
  const names = completion
    ? STATE_CODES.flatMap((state) => [
        { name: LABOUR_STATES[state], place: state },
        { name: state, place: state },
      ])
    : TRANSFER_AREAS.map((area) => ({ name: area, place: area }));
  for (const { name, place } of names.sort((a, b) => b.name.length - a.name.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, name === "ACT" ? "g" : "gi");
    if (pattern.test(rest)) {
      places.push(place);
      pattern.lastIndex = 0;
      rest = rest.replace(pattern, " ");
    }
  }
  rest = rest
    .replace(
      /\b(?:what|are|is|were|was|the|in|for|of|and|versus|vs|compare|show|me|tell|about|how|many|latest|current|figures|data|reporting|period|during|original|quarterly|recorded|median|medians|sale|sales|price|prices|transfer|transfers|established|houses|house|attached|dwelling|dwellings|units|completions|completion|completed|state|territory)\b/gi,
      " "
    )
    .replace(/[\s?,.:;'’()-]/g, "");
  if (rest || !places.length || places.length > 6 || new Set(places).size !== places.length)
    return null;
  return {
    kind: completion ? ("completions" as const) : ("transfers" as const),
    places,
    period: periods[0],
  };
}

export async function quarterlyHousingFacts(question: string): Promise<FactEvidence[]> {
  const scope = quarterlyHousingScope(question);
  if (!scope) return [];
  const data =
    scope.kind === "transfers" ? await getHousingTransfers() : await getHousingCompletions();
  const period = housingPeriod(data, new Date().toISOString(), scope.period);
  if (!period || !data.retrievedAt) return [];
  return scope.places.flatMap((place) => {
    const row = data.observations.find(
      (r) => r.period === period && ("area" in r ? r.area : r.state) === place
    );
    if (!row) return [];
    const label = "state" in row ? LABOUR_STATES[row.state] : row.area;
    const value = (n: number | null, currency = false) =>
      n === null ? "unavailable" : `${currency ? "$" : ""}${n.toLocaleString("en-AU")}`;
    const text =
      "area" in row
        ? `${label}, ${quarterLabel(period)}. Established houses: median sale price ${value(row.houseMedian, true)}, recorded transfers ${value(row.houseTransfers)}. Attached dwellings: median sale price ${value(row.attachedMedian, true)}, recorded transfers ${value(row.attachedTransfers)}. ABS original, unstratified medians for the published area. These separate property segments are not suburb observations. A median change is not a price-growth index; transfers are sales, not listings. Latest-quarter observations are preliminary and the last ten quarters may be revised.`
        : `${label}, ${quarterLabel(period)}. Dwelling units completed during the quarter: ${value(row.quarter)}. Total over four consecutive quarters ending in this period: ${value(row.year)}. ABS original series, all sectors, building types and work types. Whole state/territory, not a city or suburb estimate. Completions are not approvals, starts, listings or net additions after demolitions. Do not compare a state total directly with a city's differently dated approvals.`;
    return [
      {
        quarterlyHousing: { kind: scope.kind, place, period },
        title: `${label}: ${scope.kind === "transfers" ? "sale medians and transfers" : "dwelling completions"}`,
        date: period,
        href: housingHref(scope.kind, label, period),
        publisher: "Australian Bureau of Statistics",
        sourceUrl: data.sourceUrl,
        text: `${text} Retrieved ${data.retrievedAt}; retrieval is not publication.`,
      },
    ];
  });
}

/** Supplemental current context may support a broader synthesis, but never
 * qualifies that question for the deterministic complete-answer shortcut. */
export async function quarterlyHousingContext(question: string): Promise<FactEvidence[]> {
  if (
    !/\b(?:property|market|outlook|supply|construction|prices?|sales?|completions?)\b/i.test(
      question
    ) ||
    /\b(?:19\d{2}|20\d{2}|Q[1-4]|historical|previous|last|next|suburb|postcode|lga|council|city of|western|eastern|northern|southern|north|south|east|west)\b/i.test(
      question
    )
  )
    return [];
  const cities = PUBLIC_MARKETS.filter(
    (m) =>
      TRANSFER_AREAS.some((a) => a === m.name) && new RegExp(`\\b${m.name}\\b`, "i").test(question)
  );
  if (!cities.length || cities.length > 3) return [];
  const groups = await Promise.all(
    cities.map(async (city) => {
      const [sales, completions] = await Promise.all([
        quarterlyHousingFacts(`Median sale prices and transfers in ${city.name}`),
        quarterlyHousingFacts(`Dwelling completions in ${city.state}`),
      ]);
      return [...sales, ...completions];
    })
  );
  // Each city receives a sales source before any state context uses a slot.
  return [0, 1].flatMap((i) => groups.flatMap((g) => (g[i] ? [g[i]!] : [])));
}

export function directQuarterlyHousingAnswer(
  question: string,
  facts: FactEvidence[],
  evidence: AskContextSource[]
) {
  const scope = quarterlyHousingScope(question);
  if (!scope) return null;
  const selected = scope.places.map((place) => {
    const rows = facts.filter(
      (f) =>
        f.quarterlyHousing?.kind === scope.kind &&
        f.quarterlyHousing.place === place &&
        (!scope.period || f.date === scope.period)
    );
    if (rows.length !== 1) return null;
    const fact = rows[0]!;
    const source = evidence.find(
      (e) =>
        e.kind === "metric" &&
        e.category === "LOCAL DATA" &&
        e.title === fact.title &&
        e.date === fact.date &&
        e.text === fact.text
    );
    if (
      !source ||
      fact.date !== fact.quarterlyHousing!.period ||
      fact.publisher !== "Australian Bureau of Statistics" ||
      !/^https:\/\/www\.abs\.gov\.au\/statistics\/(?:economy\/price-indexes-and-inflation\/total-value-dwellings\/(?:mar|jun|sep|dec)-quarter-20\d{2}|industry\/building-and-construction\/building-activity-australia\/(?:mar|jun|sep|dec)-20\d{2})$/.test(
        fact.sourceUrl
      )
    )
      return null;
    return { fact, source };
  });
  if (selected.some((r) => !r) || new Set(selected.map((r) => r?.fact.date)).size !== 1)
    return null;
  const rows = selected.filter((r) => r !== null);
  return {
    status: "answered" as const,
    headline: `${scope.kind === "transfers" ? "Sale medians and recorded transfers" : "State dwelling completions"}: ${quarterLabel(rows[0]!.fact.date)}`,
    answer: rows.map(({ fact, source }) => `${fact.text} [Source ${source.ref}]`).join("\n\n"),
    whyItMatters:
      "Each observation has the requested geography, measure and reporting quarter. Missing values remain unavailable, not zero. These observations do not establish an investment ranking or explain causes.",
    deskTake:
      "Use the linked reporting period and methodology. Sales mix, geographic boundaries, revisions and different release schedules matter when comparing housing figures.",
    whatWouldChangeOurMind:
      "A revision to these ABS observations changes the figures. Later quarters describe a different period and must be cited separately.",
    signals: [],
    sourceRefs: rows.map((r) => r.source.ref),
    confidence: "high" as const,
  };
}
