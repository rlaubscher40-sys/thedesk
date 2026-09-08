import type { DailyMetric } from "../db/schema";
import { askQueryTerms, hasAskTerm } from "./relevance";
import { PROPERTY_REGIONS } from "../../shared/propertyCoverage";

function queryGeography(question: string) {
  let topic = question;
  const places: string[] = [];
  const regions = PROPERTY_REGIONS.filter((region) => {
    let matched = false;
    for (const alias of [region.name, ...region.places, region.code]) {
      // Lowercase "act" is usually a verb; the other abbreviations are useful
      // in lowercase questions too. Registry aliases contain only letters/spaces.
      const pattern = new RegExp(`\\b${alias}\\b`, alias === "ACT" ? "g" : "gi");
      if (!pattern.test(question)) continue;
      matched = true;
      if (region.places.some((place) => place === alias)) places.push(alias);
      topic = topic.replace(pattern, " ");
    }
    return matched;
  });
  return { topic, places, regions };
}

/** Known structured series retain their original geography. City questions may
 * use explicitly labelled state context, but never another city's approvals. */
function scopedMetricRegion(metric: DailyMetric) {
  return PROPERTY_REGIONS.find(
    (region) =>
      new RegExp(
        `^${region.code.toLowerCase()}_(auction_clearance|population(?:_growth_annual)?|net_(internal|overseas)_migration_12m)$`
      ).test(metric.metricKey) ||
      metric.metricKey === `${region.places[0].toLowerCase()}_approvals_12m`
  );
}

/**
 * Small, explicit synonym families. These are retrieval aids, not analytical
 * assumptions: they only decide which already-stored metric rows are offered
 * to the grounded answer model.
 */
const QUERY_EXPANSIONS: Record<string, string[]> = {
  interest: ["cash", "mortgage", "rba"],
  mortgage: ["interest", "cash", "lending", "loans"],
  rba: ["cash", "interest"],
  lending: ["credit", "finance", "loan", "loans", "approvals"],
  credit: ["lending", "finance", "loan", "loans", "approvals"],
  supply: ["listings", "listing", "approvals", "construction", "dwelling", "dwellings"],
  listings: ["supply", "listing", "stock"],
  rent: ["rents", "rental", "vacancy"],
  rents: ["rent", "rental", "vacancy"],
  migration: ["population", "interstate", "overseas"],
  population: ["migration", "interstate", "overseas"],
  prices: ["price", "values", "value", "growth"],
  price: ["prices", "values", "value", "growth"],
  jobs: ["employment", "unemployment", "labour", "wages"],
  employment: ["jobs", "unemployment", "labour", "wages"],
};

function normalise(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[_/.-]+/g, " ")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function askMetricTerms(question: string): string[] {
  const base = askQueryTerms(question);
  const expanded = new Set<string>(base);
  // A bare rates question can mean interest rates. A vacancy/unemployment
  // question must not acquire that interpretation from the word "rate".
  if (base.length > 0 && base.every((word) => ["rate", "rates"].includes(word))) {
    for (const word of ["interest", "cash", "mortgage"]) expanded.add(word);
  }
  for (const word of base) {
    for (const synonym of QUERY_EXPANSIONS[word] ?? []) expanded.add(synonym);
  }
  return [...expanded];
}

function metricHaystack(metric: DailyMetric): string {
  return normalise(
    [metric.metricKey, metric.label, metric.context, metric.groupKey, metric.source]
      .filter(Boolean)
      .join(" ")
  );
}

function scoreMetric(question: string, metric: DailyMetric): number {
  const geography = queryGeography(question);
  const scope = scopedMetricRegion(metric);
  if (scope && geography.regions.length) {
    if (!geography.regions.includes(scope)) return 0;
    if (
      metric.metricKey.endsWith("_approvals_12m") &&
      geography.places.length &&
      !geography.places.includes(scope.places[0])
    )
      return 0;
  }
  const query = normalise(question);
  const label = normalise(metric.label);
  const key = normalise(metric.metricKey);
  const group = normalise(metric.groupKey);
  const haystack = metricHaystack(metric);
  const terms = askMetricTerms(geography.topic);
  const directTerms = askQueryTerms(geography.topic);
  const topicalTerms = terms.filter(
    (term) => !["rate", "rates", "value", "values", "growth", "change", "changes"].includes(term)
  );
  if (topicalTerms.length > 0 && !topicalTerms.some((term) => hasAskTerm(haystack, term))) return 0;

  let score = scope && geography.regions.includes(scope) ? 8 : 0;
  if (scope && geography.regions.includes(scope) && metric.metricKey.endsWith("_auction_clearance")) score += 16;
  if (metric.metricKey === "auction_clearance" && !geography.regions.length) score += 10;
  if (label && ` ${query} `.includes(` ${label} `)) score += 12;
  if (key && ` ${query} `.includes(` ${key} `)) score += 12;
  if (group && ` ${query} `.includes(` ${group} `)) score += 5;

  for (const term of terms) {
    if (!hasAskTerm(haystack, term)) continue;
    score += 2;
    if (hasAskTerm(label, term) || hasAskTerm(key, term)) score += 2;
    if (directTerms.includes(term) && (hasAskTerm(label, term) || hasAskTerm(key, term)))
      score += 4;
    if (group === term) score += 1;
  }

  // Context is valuable because the metrics ingest can add a precise market
  // description even when the row's stable label is terse.
  if (metric.context && terms.some((term) => hasAskTerm(metric.context!, term))) {
    score += 1;
  }
  return score;
}

/**
 * Return only metrics that have lexical evidence of bearing on the question.
 * A generic Ask should not silently inject every dashboard number and invite
 * the model to manufacture a relationship between unrelated data.
 */
export function rankAskMetrics(question: string, metrics: DailyMetric[], limit = 6): DailyMetric[] {
  return metrics
    .map((metric) => ({ metric, score: scoreMetric(question, metric) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.metric.displayOrder ?? 100) - (b.metric.displayOrder ?? 100);
    })
    .slice(0, limit)
    .map(({ metric }) => metric);
}

export function displayMetricValue(value: string, unit: string | null | undefined): string {
  const cleanValue = value.trim();
  const cleanUnit = unit?.trim();
  if (!cleanUnit) return cleanValue;

  const lowerValue = cleanValue.toLowerCase();
  const lowerUnit = cleanUnit.toLowerCase();
  if (
    lowerValue.endsWith(lowerUnit) ||
    (cleanUnit === "%" && cleanValue.includes("%")) ||
    (cleanUnit === "$" && cleanValue.startsWith("$"))
  ) {
    return cleanValue;
  }

  // Symbol units read attached; word units read with a space.
  if (["%", "°", "x"].includes(cleanUnit)) return `${cleanValue}${cleanUnit}`;
  if (cleanUnit === "$") return `$${cleanValue}`;
  return `${cleanValue} ${cleanUnit}`;
}
