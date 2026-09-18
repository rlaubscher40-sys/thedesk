import { STATE_CODES } from "../../shared/localData";
import { LABOUR_STATES, labourHref, readStateLabour } from "../../shared/stateLabour";
import { getStateLabour } from "../markets/absLabour";
import { requestedLocalPeriods } from "../localData/requestedPeriods";
import type { FactEvidence } from "../localData/read";

/** Conservative state-only question scope. An unrecognised locality or measure
 * must not silently become a whole-state employment answer. */
export function stateLabourScope(question: string) {
  if (!/\b(?:employment|unemployment|employed|participation|labour|labor|jobs)\b/i.test(question))
    return null;
  if (/\b(?:how many|number of|count of) jobs\b/i.test(question)) return null;
  let rest = question;
  const states = STATE_CODES.filter((state) => {
    const pattern = new RegExp(
      `\\b(?:${LABOUR_STATES[state]}|${state})\\b`,
      state === "ACT" ? "g" : "gi"
    );
    const found = pattern.test(rest);
    pattern.lastIndex = 0;
    rest = rest.replace(pattern, " ");
    return found;
  });
  if (!states.length || states.length > 6) return null;
  const periods = requestedLocalPeriods(question);
  if (
    periods.length > 1 ||
    periods.some((p) => !/^20\d{2}-(0[1-9]|1[0-2])$/.test(p)) ||
    /\b(?:quarter|Q[1-4])\b/i.test(question)
  )
    return null;
  rest = rest
    .replace(/\b20\d{2}-(?:0[1-9]|1[0-2])\b/g, " ")
    .replace(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+20\d{2}\b/gi,
      " "
    )
    .replace(
      /\b(?:what|are|is|the|in|for|of|and|or|versus|vs|compare|show|me|tell|about|how|many|people|were|employed|employment|unemployment|participation|rate|rates|labour|labor|market|markets|jobs|number|monthly|change|trend|latest|current|figures|data|state|states|territory|territories|reporting|period|to|with)\b/gi,
      " "
    )
    .replace(/[\s?,.:;'’()-]/g, "");
  if (rest) return null;
  return { states, period: periods[0] };
}

export async function stateLabourFacts(question: string): Promise<FactEvidence[]> {
  const scope = stateLabourScope(question);
  if (!scope) return [];
  const { states, period } = scope;
  const data = await getStateLabour();
  return states.flatMap((state) => {
    const row = readStateLabour(data, state, new Date().toISOString(), period);
    if (!row || !data.period) return [];
    return [
      {
        stateLabour: { period: data.period, observation: row },
        title: `${LABOUR_STATES[state]}: state labour market`,
        date: data.period,
        href: labourHref(state, data.period),
        publisher: "Australian Bureau of Statistics",
        sourceUrl: data.sourceUrl,
        text: `Geography: whole ${LABOUR_STATES[state]} state/territory, not a city, suburb or local employment market. Reporting month ${data.period}. All measures are TREND, not seasonally adjusted or original. Employed people: ${row.employedPeople}; monthly employment change: ${row.employmentMonthlyPercent}%; unemployment rate: ${row.unemploymentPercent}%; participation rate: ${row.participationPercent}%. Employment counts people, not jobs or job vacancies. Monthly change is not annual growth. Trend estimates are revised and smooth short-term volatility. ${period ? "Requested reporting period; not necessarily current conditions. " : ""}Retrieved ${data.retrievedAt}; retrieval is not publication. Do not infer a housing price forecast or rank investment markets from these figures.`,
      },
    ];
  });
}
