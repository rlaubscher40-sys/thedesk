import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../markets/absQuarterlyHousing", () => ({
  getHousingTransfers: vi.fn(),
  getHousingCompletions: vi.fn(),
}));
import { getHousingTransfers, getHousingCompletions } from "../markets/absQuarterlyHousing";
import {
  quarterlyHousingScope,
  quarterlyHousingFacts,
  quarterlyHousingContext,
  directQuarterlyHousingAnswer,
} from "./quarterlyHousing";
import { TRANSFER_SOURCE, COMPLETION_SOURCE } from "../../shared/quarterlyHousing";
import type { FactEvidence } from "../localData/read";
const pack = (facts: FactEvidence[]) =>
  facts.map((f, i) => ({
    ref: i + 3,
    kind: "metric" as const,
    category: "LOCAL DATA",
    title: f.title,
    date: f.date,
    text: f.text,
  }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17"));
  vi.mocked(getHousingTransfers).mockResolvedValue({
    status: "available",
    period: "2026-Q2",
    retrievedAt: "2026-09-17",
    sourceUrl: TRANSFER_SOURCE.replace("latest-release", "jun-quarter-2026"),
    resourceUrl: null,
    observations: [
      {
        area: "Brisbane",
        period: "2026-Q2",
        houseMedian: 1155000,
        attachedMedian: 830100,
        houseTransfers: 6559,
        attachedTransfers: 3509,
      },
      {
        area: "Perth",
        period: "2026-Q2",
        houseMedian: 1010000,
        attachedMedian: 730000,
        houseTransfers: 5154,
        attachedTransfers: 2369,
      },
    ],
  });
  vi.mocked(getHousingCompletions).mockResolvedValue({
    status: "available",
    period: "2026-Q1",
    retrievedAt: "2026-09-17",
    sourceUrl: COMPLETION_SOURCE.replace("latest-release", "mar-2026"),
    resourceUrl: null,
    observations: [{ state: "QLD", period: "2026-Q1", quarter: 8035, year: 33060 }],
  });
});
afterEach(() => vi.useRealTimers());
it("answers complete same-period comparisons with packed citations and no growth inference", async () => {
  const question =
    "Compare median sale prices and recorded transfers in Brisbane and Perth in June quarter 2026";
  const facts = await quarterlyHousingFacts(question),
    answer = directQuarterlyHousingAnswer(question, facts, pack(facts));
  expect(facts).toHaveLength(2);
  expect(answer?.sourceRefs).toEqual([3, 4]);
  expect(answer?.answer).toContain("$1,155,000");
  expect(answer?.answer).toContain("$1,010,000");
  expect(answer?.answer).toContain("not a price-growth index");
  expect(facts[0]?.href).toContain("transferPeriod=2026-Q2");
  expect(directQuarterlyHousingAnswer(question, facts.slice(0, 1), pack(facts))).toBeNull();
  expect(directQuarterlyHousingAnswer(question, facts, pack(facts).slice(0, 1))).toBeNull();
  expect(directQuarterlyHousingAnswer(question, [...facts, facts[0]!], pack(facts))).toBeNull();
});
it("preserves state completions, four-quarter windows and unavailable historical periods", async () => {
  const q = "What are dwelling completions in Queensland in 2026-Q1?";
  const facts = await quarterlyHousingFacts(q),
    answer = directQuarterlyHousingAnswer(q, facts, pack(facts));
  expect(answer?.answer).toContain("8,035");
  expect(answer?.answer).toContain("33,060");
  expect(answer?.answer).toContain("not a city");
  expect(await quarterlyHousingFacts(q.replace("Q1", "Q2"))).toEqual([]);
  expect(await quarterlyHousingFacts(q.replace("2026", "2025"))).toEqual([]);
});
it.each([
  "Compare Brisbane and Townsville prices",
  "Compare Brisbane and Perth yields",
  "Brisbane price growth in June quarter 2026",
  "Brisbane listings and sales",
  "Brisbane completions",
  "Queensland seasonally adjusted completions",
  "Queensland completions in March 2026",
  "Queensland completions in 2026",
  "Queensland completions in 2026-Q1 and 2026-Q2",
  "What caused Brisbane prices to rise?",
  "Median Brisbane prices and Queensland completions",
  "Rest of Qld. house prices and Bowen Hills",
])("rejects unsupported complete request: %s", (q) => expect(quarterlyHousingScope(q)).toBeNull());
it("retains rest-of-state aggregates as distinct areas", () => {
  expect(quarterlyHousingScope("Median sale prices in Rest of Qld. in 2026-Q2")?.places).toEqual([
    "Rest of Qld.",
  ]);
});
it("adds explicitly labelled current city sales and state construction context without claiming a complete broad answer", async () => {
  const q = "What is Brisbane's property outlook?",
    facts = await quarterlyHousingContext(q);
  expect(facts.map((f) => f.quarterlyHousing?.place)).toEqual(["Brisbane", "QLD"]);
  expect(directQuarterlyHousingAnswer(q, facts, pack(facts))).toBeNull();
  for (const bad of [
    "Brisbane property outlook in 2025",
    "Western Sydney market outlook",
    "Brisbane suburb prices",
    "Brisbane property outlook last year",
  ])
    expect(await quarterlyHousingContext(bad)).toEqual([]);
});
