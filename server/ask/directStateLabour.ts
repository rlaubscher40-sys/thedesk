import { LABOUR_STATES, readStateLabour } from "../../shared/stateLabour";
import type { FactEvidence } from "../localData/read";
import type { AskContextSource } from "../prompts/ask";
import { stateLabourScope } from "./stateLabourFacts";

/** Only complete, source-matched state table lookups bypass model synthesis. */
export function directStateLabourAnswer(
  question: string,
  facts: FactEvidence[],
  evidence: AskContextSource[]
) {
  const scope = stateLabourScope(question);
  if (
    !scope ||
    /\bjobs\b|\bemployment rates?\b/i.test(question) ||
    (/\bchange\b/i.test(question) &&
      (!/\bemployment\b/i.test(question) || /\b(?:unemployment|participation)\b/i.test(question)))
  )
    return null;
  const rows = scope.states.map((state) => {
    const matching = facts.filter((fact) => fact.stateLabour?.observation.state === state);
    if (matching.length !== 1) return null;
    const fact = matching[0]!;
    const { period, observation: row } = fact.stateLabour!;
    const [year, month] = period.split("-");
    const monthName = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ][Number(month) - 1];
    const source = evidence.find(
      (entry) =>
        entry.kind === "metric" &&
        entry.category === "LOCAL DATA" &&
        entry.title === fact.title &&
        entry.date === period &&
        entry.text === fact.text
    );
    if (
      !source ||
      fact.date !== period ||
      fact.publisher !== "Australian Bureau of Statistics" ||
      fact.sourceUrl !==
        `https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/${monthName}-${year}` ||
      !Number.isSafeInteger(row.employedPeople) ||
      row.employedPeople <= 0 ||
      ![row.employmentMonthlyPercent, row.unemploymentPercent, row.participationPercent].every(
        Number.isFinite
      ) ||
      Math.abs(row.employmentMonthlyPercent) > 100 ||
      row.unemploymentPercent < 0 ||
      row.unemploymentPercent > 100 ||
      row.participationPercent < 0 ||
      row.participationPercent > 100 ||
      !readStateLabour(
        {
          status: "available",
          period,
          sourceUrl: fact.sourceUrl,
          retrievedAt: null,
          observations: [row],
        },
        state,
        new Date().toISOString(),
        scope.period
      )
    )
      return null;
    return { row, source, period };
  });
  if (rows.some((row) => row === null)) return null;
  const selected = rows.filter((row) => row !== null);
  if (new Set(selected.map((row) => row.period)).size !== 1) return null;
  const period = selected[0]!.period;
  return {
    status: "answered" as const,
    headline: `State labour market: ${scope.states.join(" and ")}, ${period}`,
    answer: selected
      .map(
        ({ row, source }) =>
          `${LABOUR_STATES[row.state]} — unemployment rate: ${row.unemploymentPercent.toFixed(1)}%; participation rate: ${row.participationPercent.toFixed(1)}%; employed people: ${row.employedPeople.toLocaleString("en-AU")}; monthly employment change: ${row.employmentMonthlyPercent.toFixed(1)}%. All figures are ABS trend estimates for ${period}. [Source ${source.ref}]`
      )
      .join("\n\n"),
    whyItMatters:
      "These are the same ABS measures and reporting month for whole states or territories. Trend estimates smooth monthly volatility and may be revised. They are not seasonally adjusted figures or city/suburb estimates.",
    deskTake:
      "Employment counts people, not jobs or vacancies. Monthly employment change is not annual growth. These observations do not establish a housing price outlook, explain causes or identify a better investment.",
    whatWouldChangeOurMind:
      "An ABS revision for this reporting month would change these figures. A later release describes another period and must be cited separately.",
    signals: [],
    sourceRefs: selected.map(({ source }) => source.ref),
    confidence: "high" as const,
  };
}
