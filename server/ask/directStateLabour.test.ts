import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FactEvidence } from "../localData/read";
import { directStateLabourAnswer } from "./directStateLabour";
const question = "Compare NSW and Queensland unemployment in July 2026";
const facts: FactEvidence[] = ["NSW", "QLD"].map((state) => ({
  stateLabour: {
    period: "2026-07",
    observation: {
      state: state as "NSW" | "QLD",
      employedPeople: state === "NSW" ? 4564800 : 3052100,
      employmentMonthlyPercent: 0.2,
      unemploymentPercent: 4.2,
      participationPercent: state === "NSW" ? 66.2 : 67.1,
    },
  },
  title: `${state} state labour market`,
  date: "2026-07",
  href: `/markets?q=${state}&labourPeriod=2026-07`,
  publisher: "Australian Bureau of Statistics",
  sourceUrl:
    "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/jul-2026",
  text: `${state} unemployment is 4.2%, trend, July 2026.`,
}));
const pack = (items: FactEvidence[]) =>
  items.map((fact, i) => ({
    ref: i + 4,
    kind: "metric" as const,
    category: "LOCAL DATA",
    title: fact.title,
    date: fact.date,
    text: fact.text,
  }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17"));
});
afterEach(() => vi.useRealTimers());
it("answers the live failed comparison from the verified rows and packed citation numbers", () => {
  const result = directStateLabourAnswer(question, facts, pack(facts));
  expect(result?.status).toBe("answered");
  expect(result?.answer).toContain("New South Wales — unemployment rate: 4.2%");
  expect(result?.answer).toContain("Queensland — unemployment rate: 4.2%");
  expect(result?.answer).toContain("[Source 4]");
  expect(result?.sourceRefs).toEqual([4, 5]);
  expect(result?.whyItMatters).toContain("not seasonally adjusted");
});
it.each([
  "Compare NSW and London unemployment in July 2026",
  "Compare NSW and Queensland unemployment in June 2026",
  "Compare NSW and Queensland unemployment in June and July 2026",
  "What is unemployment in Sydney NSW in July 2026?",
  "What is seasonally adjusted unemployment in NSW in July 2026?",
  "Why did unemployment change in NSW in July 2026?",
  "How many jobs are in NSW in July 2026?",
  "Compare NSW and Queensland unemployment in July 2026 and housing prices",
  "What is monthly unemployment change in NSW in July 2026?",
  "What is the employment rate in NSW in July 2026?",
])("does not bypass review for a changed or incomplete scope: %s", (q) => {
  expect(directStateLabourAnswer(q, facts, pack(facts))).toBeNull();
});
it("refuses partial, duplicated or unpacked evidence", () => {
  expect(directStateLabourAnswer(question, facts.slice(0, 1), pack(facts))).toBeNull();
  expect(directStateLabourAnswer(question, [...facts, facts[0]!], pack(facts))).toBeNull();
  expect(directStateLabourAnswer(question, facts, pack(facts).slice(0, 1))).toBeNull();
});
it("refuses non-finite data and mixed periods", () => {
  const invalid = structuredClone(facts);
  invalid[0]!.stateLabour!.observation.unemploymentPercent = NaN;
  expect(directStateLabourAnswer(question, invalid, pack(invalid))).toBeNull();
  invalid[0] = {
    ...facts[0]!,
    date: "2026-06",
    stateLabour: { ...facts[0]!.stateLabour!, period: "2026-06" },
  };
  expect(
    directStateLabourAnswer("Compare NSW and Queensland unemployment", invalid, pack(invalid))
  ).toBeNull();
});
it("does not present stale undated observations as current", () => {
  vi.setSystemTime(new Date("2026-12-17"));
  expect(
    directStateLabourAnswer("Compare NSW and Queensland unemployment", facts, pack(facts))
  ).toBeNull();
  expect(directStateLabourAnswer(question, facts, pack(facts))?.status).toBe("answered");
});
