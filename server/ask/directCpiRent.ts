import { RENT_CITIES, rentPeriod } from "../../shared/cityRents";
import { requestedLocalPeriods } from "../localData/requestedPeriods";
import type { FactEvidence } from "../localData/read";
import type { AskContextSource } from "../prompts/ask";

/** A bounded factual lookup. No model, inferred geography, substituted period,
 * asking-rent proxy or investment recommendation. Citations use packed refs. */
export function directCpiRentAnswer(
  question: string,
  facts: FactEvidence[],
  evidence: AskContextSource[]
) {
  if (
    !/\brents?\b/i.test(question) ||
    !/\b(?:annual|year|CPI|actually paid)\b/i.test(question) ||
    !/\b(?:what|how|compare|show|give)\b/i.test(question) ||
    /\b(?:why|caus\w*|drivers?|forecast|outlook|will|next|should|invest\w*|buy|yield|vacanc\w*|weekly|median|asking|advertised|suburb|postcode|LGA|council|bedrooms?|houses?|apartments?|last|previous|since|between)\b/i.test(
      question
    )
  )
    return null;
  const cities = RENT_CITIES.filter((city) => new RegExp(`\\b${city}\\b`, "i").test(question));
  const periods = requestedLocalPeriods(question);
  // Exact dated queries only. An undated question can still use normal synthesis.
  if (
    !cities.length ||
    cities.length > 4 ||
    periods.length !== 1 ||
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(periods[0]!)
  )
    return null;
  const rows = cities.map((city) => {
    const matching = facts.filter(
      (f) => f.cpiRent?.city === city && f.cpiRent.period === periods[0]
    );
    if (matching.length !== 1) return null;
    const fact = matching[0]!;
    const row = fact.cpiRent!;
    const source = evidence.find(
      (s) =>
        s.kind === "metric" &&
        s.category === "LOCAL DATA" &&
        s.title === fact.title &&
        s.date === row.period &&
        s.text === fact.text
    );
    if (
      !source ||
      !Number.isFinite(row.annualPercent) ||
      row.annualPercent < -100 ||
      row.annualPercent > 100 ||
      !["", "p", "r"].includes(row.status)
    )
      return null;
    return { row, source };
  });
  if (rows.some((row) => row === null)) return null;
  const selected = rows.filter((row) => row !== null);
  const period = rentPeriod(periods[0]!);
  const answer = selected
    .map(
      ({ row, source }) =>
        `${row.city}: annual change in rents actually paid was ${row.annualPercent.toFixed(1)}% in the year to ${period}.${row.status === "p" ? " The observation is preliminary." : row.status === "r" ? " The observation is revised." : ""} [Source ${source.ref}]`
    )
    .join("\n\n");
  const comparison =
    selected.length === 2
      ? ` The difference between these annual rates is ${Math.abs(selected[0]!.row.annualPercent - selected[1]!.row.annualPercent).toFixed(1)} percentage points.`
      : "";
  return {
    status: "answered" as const,
    headline: `Annual rents paid: ${cities.join(" and ")}, ${period}`,
    answer: answer + comparison,
    whyItMatters:
      "The ABS capital-city CPI series measures the annual change in rents actually paid to private and government landlords. It does not measure the latest month's rent change, advertised asking rents, rental yields or vacancies.",
    deskTake:
      "These observations compare the same measure and reference month. They do not identify a better investment or explain why rents changed. City-wide rates do not describe an individual suburb or dwelling.",
    whatWouldChangeOurMind:
      "An ABS revision for this reference month would change these figures. A later release describes a different period and must be cited separately.",
    signals: [],
    sourceRefs: selected.map(({ source }) => source.ref),
    confidence: "high" as const,
  };
}
