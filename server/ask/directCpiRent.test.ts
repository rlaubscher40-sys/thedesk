import { expect, it } from "vitest";
import { directCpiRentAnswer } from "./directCpiRent";
import type { FactEvidence } from "../localData/read";
import type { AskContextSource } from "../prompts/ask";
const facts: FactEvidence[] = ["Brisbane", "Perth"].map((city, i) => ({
  title: `${city}: annual CPI rent change`,
  date: "2026-07",
  href: `/markets?q=${city}`,
  publisher: "Australian Bureau of Statistics",
  sourceUrl: "https://www.abs.gov.au/",
  text: `${city} observation`,
  cpiRent: { city, period: "2026-07", annualPercent: i ? 5.3 : 4.6, status: "" },
}));
const evidence: AskContextSource[] = facts.map((f, i) => ({
  ref: i + 3,
  kind: "metric",
  category: "LOCAL DATA",
  title: f.title,
  date: f.date,
  text: f.text,
}));
const question = "How did annual rents actually paid change in Brisbane and Perth in July 2026?";
it("answers the audited question using typed observations and actual packed references", () => {
  const answer = directCpiRentAnswer(question, facts, evidence)!;
  expect(answer.answer).toContain("4.6%");
  expect(answer.answer).toContain("5.3%");
  expect(answer.answer).toContain("0.7 percentage points");
  expect(answer.sourceRefs).toEqual([3, 4]);
});
it.each([
  "How did annual rents change in Brisbane and Perth in August 2026?",
  "Why did annual rents change in Brisbane and Perth in July 2026?",
  "Compare annual rents in Brisbane and Perth between June 2026 and July 2026",
  "What annual rent yield should I expect in Brisbane in July 2026?",
  "What were annual asking rents in Brisbane in July 2026?",
  "What were annual rents in Brisbane last July?",
])("leaves incompatible questions to normal evidence review: %s", (q) =>
  expect(directCpiRentAnswer(q, facts, evidence)).toBeNull()
);
it("cannot drop a requested city, duplicate an observation or cite unpacked evidence", () => {
  expect(directCpiRentAnswer(question, facts.slice(0, 1), evidence)).toBeNull();
  expect(directCpiRentAnswer(question, [...facts, facts[0]!], evidence)).toBeNull();
  expect(directCpiRentAnswer(question, facts, evidence.slice(0, 1))).toBeNull();
  expect(
    directCpiRentAnswer(
      question,
      [{ ...facts[0]!, cpiRent: { ...facts[0]!.cpiRent!, annualPercent: NaN } }, facts[1]!],
      evidence
    )
  ).toBeNull();
});

it.each([
  "Compare annual rents in Brisbane and Newcastle in July 2026",
  "Compare annual rents in Brisbane and London in July 2026",
  "What were annual rents in Brisbane excluding Perth in July 2026?",
  "What were annual rents outside Brisbane in July 2026?",
  "Compare annual rents in Brisbane and Perth in July 2026. What were wages?",
  "Compare annual rents in Brisbane and Perth in July 2026 and rank affordability",
  "What were annual rents in North Brisbane in July 2026?",
])("does not silently answer only the supported part of a request: %s", (q) => {
  expect(directCpiRentAnswer(q, facts, evidence)).toBeNull();
});
it.each([
  "What was annual CPI rent growth in Brisbane in July 2026?",
  "Compare annual rents in Brisbane and Perth in July 2026",
  "Show me annual rents actually paid in Brisbane, Perth for 2026-07",
])("retains complete bounded factual requests: %s", (q) => {
  expect(directCpiRentAnswer(q, facts, evidence)?.status).toBe("answered");
});
