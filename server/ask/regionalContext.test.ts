import { expect, it } from "vitest";
import { directRegionalContextAnswer, reviewedRegionalFacts } from "./regionalContext";
import { packAskEvidence } from "./evidencePolicy";
const question = "What does The Desk know about Townsville?";
const facts = reviewedRegionalFacts(question, "2026-09-18");
const evidence = facts.map((fact, i) => ({
  ref: i + 4,
  kind: "feed" as const,
  category: "REVIEWED CONTEXT",
  title: fact.title,
  date: fact.date,
  text: fact.text,
}));
it("answers the featured prompt with dated context, limitations and packed references", () => {
  const result = directRegionalContextAnswer(question, facts, evidence)!;
  expect(facts).toHaveLength(2);
  expect(result.answer).toContain("253");
  expect(result.answer).toContain("not a count of homes completed");
  expect(result.answer).toContain("First-party investor marketing");
  expect(result.answer).toContain("[Source 4]");
  expect(result.sourceRefs).toEqual([4, 5]);
  expect(facts[0]!.href).toBe("/markets/townsville#primary-context");
  expect(packAskEvidence(question, evidence, 1)).toBeNull();
});
it("does not bypass synthesis for changed questions or incomplete source packing", () => {
  for (const q of [
    question + " Should I buy?",
    "What does The Desk know about Townsville and Newcastle?",
    "What will Townsville prices do?",
    "What does The Desk know about Townsville in 2025?",
  ])
    expect(reviewedRegionalFacts(q, "2026-09-18")).toEqual([]);
  expect(directRegionalContextAnswer(question, facts, evidence.slice(0, 1))).toBeNull();
});
it("never promotes future reviews or older context into verified current status", () => {
  expect(reviewedRegionalFacts(question, "2026-09-16")).toEqual([]);
  expect(reviewedRegionalFacts(question, "2026-10-18")[0]!.text).toContain("Review is due");
  expect(
    reviewedRegionalFacts("What reviewed sources does The Desk have about Newcastle?", "2026-09-18")
  ).toHaveLength(2);
});
