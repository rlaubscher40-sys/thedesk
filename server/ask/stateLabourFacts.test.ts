import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../markets/absLabour", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../markets/absLabour")>()),
  getStateLabour: vi.fn(),
}));
import { getStateLabour, parseAbsLabour } from "../markets/absLabour";
import { stateLabourFacts } from "./stateLabourFacts";
const now = "2026-09-17T11:00:00Z";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.resetAllMocks();
  vi.mocked(getStateLabour).mockResolvedValue(
    parseAbsLabour(
      readFileSync(new URL("../markets/fixtures/abs-state-labour.html", import.meta.url), "utf8"),
      now
    )
  );
});
afterEach(() => vi.useRealTimers());
it("provides state-only facts with an exact-period citation", async () => {
  const facts = await stateLabourFacts("Compare NSW and Queensland unemployment in July 2026");
  expect(facts).toHaveLength(2);
  expect(facts[0]!.date).toBe("2026-07");
  expect(facts[0]!.href).toContain("labourPeriod=2026-07");
  expect(facts[0]!.text).toContain("not a city, suburb");
  expect(facts[0]!.text).toContain("TREND, not seasonally adjusted");
});
it.each([
  "What is unemployment in Sydney?",
  "What is employment in Townsville QLD?",
  "What is employment in Richmond NSW?",
  "What is employment in Queensland in Q2 2026?",
  "What is annual employment growth in Queensland?",
  "What are job vacancies in WA?",
  "What is NSW unemployment in June 2026?",
  "Compare NSW unemployment in June and July 2026",
  "What is seasonally adjusted unemployment in NSW?",
  "What is employment in NSW and London?",
  "How many jobs are in NSW?",
])("does not substitute geography, measure or period: %s", async (question) => {
  expect(await stateLabourFacts(question)).toEqual([]);
});
