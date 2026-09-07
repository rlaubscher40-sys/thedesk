import { describe, expect, it } from "vitest";
import type { AbsObservation } from "./absApi";
import { observationsToHistory, periodEnd } from "./backfill";

const obs = (period: string, value: number): AbsObservation => ({
  dimensions: {},
  period,
  value,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("periodEnd", () => {
  it("ends a quarter on the last day of its final month", () => {
    expect(iso(periodEnd("2026-Q1")!)).toBe("2026-03-31");
    expect(iso(periodEnd("2026-Q4")!)).toBe("2026-12-31");
  });

  it("ends a month on its last day, leap years included", () => {
    expect(iso(periodEnd("2026-02")!)).toBe("2026-02-28");
    expect(iso(periodEnd("2024-02")!)).toBe("2024-02-29");
  });

  it("ends a year on 31 December", () => {
    expect(iso(periodEnd("2026")!)).toBe("2026-12-31");
  });

  it("returns null for a period it does not understand", () => {
    expect(periodEnd("garbage")).toBeNull();
  });
});

describe("observationsToHistory", () => {
  it("gives every month two readings, so a move can be described", () => {
    // One row per observation would leave a monthly series with a single
    // reading per month, and the review needs two. Every backfilled month
    // would be silently skipped.
    const rows = observationsToHistory([obs("2026-01", 4.0), obs("2026-02", 4.1)]);
    const feb = rows.filter((r) => iso(r.recordedAt).startsWith("2026-02"));
    expect(feb).toHaveLength(2);
  });

  it("opens a month on the previously published figure", () => {
    // On 1 February the current unemployment rate really is January's. This is
    // what the live ingest records daily, so the backfill matches it.
    const rows = observationsToHistory([obs("2026-01", 4.0), obs("2026-02", 4.1)]);
    const feb = rows.filter((r) => iso(r.recordedAt).startsWith("2026-02"));
    expect(feb[0]!.value).toBe(4.0);
    expect(feb[1]!.value).toBe(4.1);
  });

  it("attributes a quarterly move to the period it describes, with no lag set", () => {
    // Q1 ends 31 March, so with the default lag of 0 the move lands in March
    // and the months before it show no change.
    const rows = observationsToHistory([obs("2025-Q4", 3.2), obs("2026-Q1", 3.5)]);
    const march = rows.filter((r) => iso(r.recordedAt).startsWith("2026-03"));
    expect(march.map((r) => r.value)).toEqual([3.2, 3.5]);

    const feb = rows.filter((r) => iso(r.recordedAt).startsWith("2026-02"));
    expect(feb.map((r) => r.value)).toEqual([3.2, 3.2]);
  });

  it("shifts the move to publication month once a lag is set", () => {
    // The live ingest records whatever is currently published, so it first sees
    // Q1's CPI in late April and puts the move there. Backfilled and live rows
    // share a table, so the lag is what stops the month where they join showing
    // a doubled or a missing move.
    const rows = observationsToHistory([obs("2025-Q4", 3.2), obs("2026-Q1", 3.5)], {
      publicationLagDays: 28,
    });
    const march = rows.filter((r) => iso(r.recordedAt).startsWith("2026-03"));
    expect(march.map((r) => r.value)).toEqual([3.2, 3.2]);

    const april = rows.filter((r) => iso(r.recordedAt).startsWith("2026-04"));
    expect(april.map((r) => r.value)).toEqual([3.2, 3.5]);
  });

  it("omits months before the series starts rather than back-projecting", () => {
    // Inventing a flat run before the first observation would create fake
    // "unchanged" months and drag down every later month's sense of normal.
    const rows = observationsToHistory([obs("2026-06", 10)]);
    expect(rows.every((r) => r.recordedAt >= new Date("2026-06-01T00:00:00Z"))).toBe(true);
  });

  it("carries a value forward across a gap in publication", () => {
    // A missing quarter does not mean the figure vanished; the last published
    // one remains in force.
    const rows = observationsToHistory([obs("2026-01", 5), obs("2026-04", 6)]);
    const march = rows.filter((r) => iso(r.recordedAt).startsWith("2026-03"));
    expect(march.map((r) => r.value)).toEqual([5, 5]);
  });

  it("keeps the row count proportionate to the span", () => {
    // Two rows a month, not one a day: decades cost hundreds of rows, not
    // hundreds of thousands.
    const twoYears = Array.from({ length: 24 }, (_, i) =>
      obs(`2025-${String((i % 12) + 1).padStart(2, "0")}`, i)
    );
    expect(observationsToHistory(twoYears).length).toBeLessThanOrEqual(30);
  });

  it("returns nothing for an empty or unreadable series", () => {
    expect(observationsToHistory([])).toEqual([]);
    expect(observationsToHistory([obs("nonsense", 1)])).toEqual([]);
  });

  it("sorts observations that arrive out of order", () => {
    const rows = observationsToHistory([obs("2026-02", 4.1), obs("2026-01", 4.0)]);
    expect(rows[0]!.value).toBe(4.0);
  });

  it("spans a year boundary without looping forever", () => {
    // November is correctly absent: the first observation lands on 30 November,
    // so there is no figure in force on the 1st, and that month is omitted
    // rather than back-projected. The run continues cleanly into the new year.
    const rows = observationsToHistory([obs("2025-11", 1), obs("2026-02", 2)]);
    const months = new Set(rows.map((r) => iso(r.recordedAt).slice(0, 7)));
    expect([...months].sort()).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
