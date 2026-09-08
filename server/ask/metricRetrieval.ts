import type { DailyMetric } from "../db/schema";
import { askQueryTerms, hasAskTerm } from "./relevance";

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
    [
      metric.metricKey,
      metric.label,
      metric.context,
      metric.groupKey,
      metric.source,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function scoreMetric(question: string, metric: DailyMetric): number {
  const query = normalise(question);
  const label = normalise(metric.label);
  const key = normalise(metric.metricKey);
  const group = normalise(metric.groupKey);
  const haystack = metricHaystack(metric);
  const terms = askMetricTerms(question);
  const topicalTerms = terms.filter((term) => !["rate", "rates", "value", "values", "growth", "change", "changes"].includes(term));
  if (topicalTerms.length > 0 && !topicalTerms.some((term) => hasAskTerm(haystack, term))) return 0;

  let score = 0;
  if (label && ` ${query} `.includes(` ${label} `)) score += 12;
  if (key && ` ${query} `.includes(` ${key} `)) score += 12;
  if (group && ` ${query} `.includes(` ${group} `)) score += 5;

  for (const term of terms) {
    if (!hasAskTerm(haystack, term)) continue;
    score += 2;
    if (hasAskTerm(label, term) || hasAskTerm(key, term)) score += 2;
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
export function rankAskMetrics(
  question: string,
  metrics: DailyMetric[],
  limit = 6
): DailyMetric[] {
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
