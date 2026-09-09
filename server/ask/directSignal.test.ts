import { afterEach, expect, it, vi } from "vitest";
import type { DailyMetric } from "../db/schema";
import { metricObservationAskHref } from "../../shared/metricObservation";
import { directApprovalsSignalAnswer } from "./directSignal";

const metric = {
  metricKey: "building_approvals",
  label: "Building approvals",
  value: "17,687",
  unit: null,
  asOf: new Date("2026-07-01"),
  updatedAt: new Date("2026-09-09"),
  source: "ABS",
} as DailyMetric;
const evidence = [
  {
    ref: 3,
    kind: "metric" as const,
    title: "Building approvals: 17,687",
    date: "2026-07-01",
    category: "PROPERTY",
    text: "Stored observation",
  },
];
const question =
  "What does Building approvals at 17,687 as of 2026-07-01 mean for property? Within the expected reporting window; check the observation date.";
afterEach(() => vi.useRealTimers());

it("answers the actual Signals link with its date, boundaries and selected citation", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09"));
  const linkedQuestion = new URL(
    metricObservationAskHref(metric, metric.value),
    "https://thedesk.au"
  ).searchParams.get("q")!;
  expect(linkedQuestion).toBe(question);
  const result = directApprovalsSignalAnswer(linkedQuestion, [metric], evidence)!;
  expect(result).toMatchObject({ status: "answered", sourceRefs: [3], confidence: "medium" });
  if (result.status !== "answered") throw new Error("Expected a structured answer");
  expect(result.answer).toContain("17,687 total dwellings, dated 2026-07-01");
  expect(result.answer).toContain("does not establish");
  expect(result.deskTake).toContain(
    "cannot establish a trend, a gap between approvals and completions"
  );
});
it("recomputes reporting status when an old link is opened later", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-01-01"));
  expect(directApprovalsSignalAnswer(question, [metric], evidence)).toMatchObject({
    status: "answered",
    answer: expect.stringContaining("Older reporting period. This is not a current observation."),
  });
});
it.each([question.replace("17,687", "18,000"), question.replace("2026-07-01", "2026-06-01")])(
  "declines a value or period that is absent instead of substituting the latest record",
  (input) => {
    expect(directApprovalsSignalAnswer(input, [metric], evidence)).toMatchObject({
      status: "insufficient",
    });
  }
);
it("declines missing evidence and invalid dates", () => {
  expect(directApprovalsSignalAnswer(question, [], evidence)).toMatchObject({
    status: "insufficient",
  });
  expect(directApprovalsSignalAnswer(question, [metric], [])).toMatchObject({
    status: "insufficient",
  });
  expect(
    directApprovalsSignalAnswer(question, [{ ...metric, asOf: new Date("bad") }], evidence)
  ).toMatchObject({ status: "insufficient" });
});
it("does not silently ignore an extra user question or answer other metrics", () => {
  expect(directApprovalsSignalAnswer(`${question} Should I buy?`, [metric], evidence)).toBeNull();
  expect(
    directApprovalsSignalAnswer("What is happening to building approvals?", [metric], evidence)
  ).toBeNull();
  expect(
    directApprovalsSignalAnswer(
      question.replace("Building approvals", "RBA cash rate"),
      [metric],
      evidence
    )
  ).toBeNull();
});
