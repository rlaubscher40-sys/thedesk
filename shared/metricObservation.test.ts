import { afterEach, expect, it, vi } from "vitest";
import { describeMetricObservation, metricObservationAskHref } from "./metricObservation";

const now = new Date("2026-09-09T08:00:00Z");
const metric = {
  metricKey: "cash_rate",
  label: "RBA cash rate",
  value: "4.35",
  asOf: new Date("2025-01-01"),
  updatedAt: now,
  source: "RBA",
};
afterEach(() => vi.useRealTimers());

it("keeps an old observation historical even after a fresh database update", () => {
  expect(describeMetricObservation(metric, now)).toMatchObject({
    date: "2025-01-01",
    dateLabel: "1 Jan 2025",
    withinReviewWindow: false,
    explanation: "Older reporting period. This is not a current observation.",
  });
});
it("distinguishes refresh failure from an old reporting period", () => {
  const result = describeMetricObservation(
    { ...metric, asOf: new Date("2026-09-08"), updatedAt: new Date("2026-09-05") },
    now
  );
  expect(result.state).toBe("collection overdue");
  expect(result.explanation).toContain("newer observation may be available");
});
it.each([new Date("bad"), new Date("2026-10-01")])(
  "does not call invalid or future observations current",
  (asOf) => {
    const result = describeMetricObservation({ ...metric, asOf }, now);
    expect(result.withinReviewWindow).toBe(false);
    expect(result.explanation).toContain("Date needs review");
  }
);
it("retains the actual date and historical limit in the Ask hand-off", () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const question = new URL(
    metricObservationAskHref(metric, "4.35%"),
    "https://thedesk.au"
  ).searchParams.get("q")!;
  expect(question).toContain("4.35% as of 2025-01-01");
  expect(question).toContain("not a current observation");
  expect(question).not.toContain("right now");
  expect(question.length).toBeLessThanOrEqual(240);
});
it("keeps complete date warnings within Ask's limit for long metric names", () => {
  const question = new URL(metricObservationAskHref({ ...metric, label: "Long published metric name ".repeat(12) }, "123456789.123456789"), "https://thedesk.au").searchParams.get("q")!;
  expect(question.length).toBeLessThanOrEqual(240);
  expect(question).toContain("as of 2025-01-01");
  expect(question).toMatch(/This is not a current observation\.$/);
});
it("does not present an unconfigured cadence as verified freshness", () => {
  expect(
    describeMetricObservation({ ...metric, metricKey: "unknown", asOf: now }, now).explanation
  ).toContain("Publication timing unverified");
});
