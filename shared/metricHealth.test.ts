import { expect, it } from "vitest";
import { metricHealth, METRIC_EXPECTATIONS } from "./metricHealth";
import { PROPERTY_REGIONS } from "./propertyCoverage";

const now = new Date("2026-09-08T12:00:00Z");
const metric = (key: string, asOf: string, storedAt = now.toISOString()) => ({
  metricKey: key,
  label: key,
  asOf: new Date(asOf),
  updatedAt: new Date(storedAt),
  source: "Fixture",
});
const status = (row: ReturnType<typeof metric>) =>
  metricHealth([row], now).find((item) => item.key === row.metricKey)!.state;
it("detects missing metrics in every state instead of hiding absent rows", () => {
  const rows = metricHealth([], now);
  for (const region of PROPERTY_REGIONS)
    expect(
      rows.find((row) => row.key === `${region.code.toLowerCase()}_population`)
        ?.state,
    ).toBe("missing");
  expect(new Set(METRIC_EXPECTATIONS.map((spec) => spec.key)).size).toBe(
    METRIC_EXPECTATIONS.length,
  );
});
it("does not let a fresh collection timestamp hide an old reporting period", () => {
  expect(status(metric("sydney_approvals_12m", "2025-01-01"))).toBe(
    "old reporting period",
  );
  expect(
    status(metric("sydney_approvals_12m", "2026-07-01", "2026-09-01")),
  ).toBe("collection overdue");
});
it("allows official publication lags but requires recent daily cash-target observations", () => {
  expect(status(metric("tas_population", "2025-12-31"))).toBe(
    "within review window",
  );
  expect(status(metric("cash_rate", "2025-01-01"))).toBe(
    "old reporting period",
  );
  expect(status(metric("cash_rate", "2026-09-07"))).toBe(
    "within review window",
  );
  expect(status(metric("audusd", "2026-09-04"))).toBe("within review window");
});
it.each([
  ["2026-09-07T23:00:00Z", "2026-09-08", "2026-09-09"],
  ["2026-01-07T13:30:00Z", "2026-01-08", "2026-01-09"],
])(
  "uses Sydney calendar dates for cash rate health at %s",
  (checkedAt, today, tomorrow) => {
    const check = (asOf: string) =>
      metricHealth(
        [metric("cash_rate", asOf, checkedAt)],
        new Date(checkedAt),
      ).find((row) => row.key === "cash_rate")!.state;
    expect(check(today)).toBe("within review window");
    expect(check(tomorrow)).toBe("invalid dates");
  },
);

it("keeps invalid storage timestamps visible even with a valid Sydney observation", () => {
  const rows = metricHealth(
    [metric("cash_rate", "2026-09-08", "2026-09-08T01:00:00Z")],
    new Date("2026-09-07T23:00:00Z"),
  );
  expect(rows.find((row) => row.key === "cash_rate")?.state).toBe(
    "invalid dates",
  );
});
it("flags invalid dates, unknown cadence and news-extracted figures for review", () => {
  expect(status(metric("cash_rate", "2026-10-01"))).toBe("invalid dates");
  expect(status(metric("cash_rate", "bad"))).toBe("invalid dates");
  expect(status(metric("new_series", "2026-09-01"))).toBe(
    "cadence unconfigured",
  );
  expect(
    status({
      ...metric("auction_clearance", "2026-09-07"),
      source: "News + LLM",
    }),
  ).toBe("check extracted evidence");
});
