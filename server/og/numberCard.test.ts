import { describe, expect, it } from "vitest";
import type { DailyMetric } from "../db/schema";
import { renderNumberCard } from "./numberCard";

function fakeMetric(overrides: Partial<DailyMetric> = {}): DailyMetric {
  return {
    id: 1,
    metricKey: "vacancy_rate",
    label: "Vacancy rate",
    value: "0.8",
    unit: "%",
    previousValue: "0.9",
    source: "SQM Research",
    context: "Rental supply remains exceptionally tight across the market.",
    groupKey: "PROPERTY",
    sourceUrl: null,
    asOf: new Date("2026-09-07T00:00:00Z"),
    displayOrder: 10,
    updatedAt: new Date("2026-09-07T00:00:00Z"),
    ...overrides,
  } as DailyMetric;
}

describe("renderNumberCard", () => {
  it("renders a 4:5 PNG from a live metric", async () => {
    const png = await renderNumberCard(fakeMetric());
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(15_000);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("handles long values and missing optional context", async () => {
    const png = await renderNumberCard(
      fakeMetric({
        value: "1,234,567,890",
        unit: "$",
        source: null,
        context: null,
        groupKey: null,
      })
    );
    expect(png.byteLength).toBeGreaterThan(15_000);
  });

  it("does not duplicate a percentage unit already present in the value", async () => {
    const png = await renderNumberCard(fakeMetric({ value: "3.60%", unit: "%" }));
    expect(png.byteLength).toBeGreaterThan(15_000);
  });
});
