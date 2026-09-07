import { describe, expect, it } from "vitest";
import type { DailyMetric } from "../db/schema";
import { MIN_SCORE, pickStatOfTheDay, type HistoryPoint } from "./statPick";

const NOW = new Date("2026-09-06T02:00:00Z");

function metric(overrides: Partial<DailyMetric> = {}): DailyMetric {
  return {
    id: 1,
    metricKey: "auction_clearance",
    label: "Auction clearance",
    value: "58.4",
    unit: "%",
    previousValue: "59.1",
    source: "CoreLogic",
    context: null,
    groupKey: "PROPERTY",
    sourceUrl: null,
    asOf: new Date("2026-09-05T00:00:00Z"),
    displayOrder: 50,
    updatedAt: NOW,
    ...overrides,
  } as DailyMetric;
}

/** `values` oldest-first, one reading per day ending the day before NOW. */
function history(values: number[]): HistoryPoint[] {
  return values.map((value, i) => ({
    value,
    recordedAt: new Date(NOW.getTime() - (values.length - i) * 86_400_000),
  }));
}

describe("pickStatOfTheDay", () => {
  it("returns null when nothing has moved", () => {
    const flat = history([60, 60, 60, 60, 60, 60, 60, 60, 60, 60]);
    expect(
      pickStatOfTheDay(
        [metric({ value: "60", previousValue: "60" })],
        { auction_clearance: flat },
        NOW
      )
    ).toBeNull();
  });

  it("returns null when there is no history at all", () => {
    expect(pickStatOfTheDay([metric()], {}, NOW)).toBeNull();
  });

  it("finds a run of falls and counts it correctly", () => {
    // Six readings, five consecutive falls between them.
    const pick = pickStatOfTheDay(
      [metric({ value: "58.4" })],
      { auction_clearance: history([64, 63, 62, 61, 60, 59.1]) },
      NOW
    );
    expect(pick).not.toBeNull();
    expect(pick!.angle).toBe("streak");
    // Five history steps plus the live value's own step = six falls.
    expect(pick!.subtext).toBe("SIX STRAIGHT FALLS IN AUCTION CLEARANCE");
    expect(pick!.direction).toBe("down");
  });

  it("spells small streak counts as words, not numerals", () => {
    const pick = pickStatOfTheDay(
      [metric({ value: "61" })],
      { auction_clearance: history([64, 63, 62]) },
      NOW
    );
    expect(pick!.subtext).toMatch(/^THREE STRAIGHT FALLS/);
  });

  it("treats a flat day as ending a streak rather than extending it", () => {
    // Three falls and then a day where the number held. The run is over, and
    // "three straight falls" is no longer today's story.
    const pick = pickStatOfTheDay(
      [metric({ value: "61", previousValue: "61" })],
      { auction_clearance: history([64, 63, 62, 61, 61]) },
      NOW
    );
    expect(pick?.angle).not.toBe("streak");
  });

  it("collapses same-day duplicate readings before counting a streak", () => {
    // The ingest ran twice on two of the days. Naively that reads as a longer
    // run of falls than actually happened.
    const base = NOW.getTime();
    const points: HistoryPoint[] = [
      { value: 64, recordedAt: new Date(base - 4 * 86_400_000) },
      { value: 63.5, recordedAt: new Date(base - 3 * 86_400_000 - 3_600_000) },
      { value: 63, recordedAt: new Date(base - 3 * 86_400_000) },
      { value: 62.5, recordedAt: new Date(base - 2 * 86_400_000 - 3_600_000) },
      { value: 62, recordedAt: new Date(base - 2 * 86_400_000) },
    ];
    const pick = pickStatOfTheDay([metric({ value: "61" })], { auction_clearance: points }, NOW);
    // Deduped: 64, 63, 62 then the live 61 = three falls, not five.
    expect(pick!.subtext).toBe("THREE STRAIGHT FALLS IN AUCTION CLEARANCE");
  });

  it("flags a threshold crossing", () => {
    // Sits just above 60 then drops below it, with no streak to outscore it.
    const pick = pickStatOfTheDay(
      [metric({ value: "59.2", previousValue: "60.4" })],
      { auction_clearance: history([58, 61, 59, 62, 60.4]) },
      NOW
    );
    expect(pick).not.toBeNull();
    expect(pick!.angle).toBe("threshold");
    expect(pick!.subtext).toBe("AUCTION CLEARANCE BELOW 60% FOR THE FIRST TIME");
  });

  it("ignores stale metrics whose source stopped publishing", () => {
    const stale = metric({ asOf: new Date("2026-07-01T00:00:00Z") });
    expect(
      pickStatOfTheDay([stale], { auction_clearance: history([64, 63, 62, 61, 60, 59]) }, NOW)
    ).toBeNull();
  });

  it("ignores metrics whose value is not a number", () => {
    expect(
      pickStatOfTheDay(
        [metric({ value: "n/a" })],
        { auction_clearance: history([64, 63, 62, 61, 60]) },
        NOW
      )
    ).toBeNull();
  });

  it("does not raise a jump on a metric whose daily wobble is noise", () => {
    // A move this size in the ASX is a Tuesday, not a story.
    const asx = metric({
      metricKey: "asx200",
      label: "ASX 200",
      unit: null,
      value: "8500",
      previousValue: "8400",
    });
    const pick = pickStatOfTheDay(
      [asx],
      { asx200: history([8400, 8402, 8399, 8401, 8398, 8400]) },
      NOW
    );
    expect(pick?.angle).not.toBe("jump");
  });

  it("raises a jump when a non-noisy metric moves far beyond its usual step", () => {
    const arrears = metric({
      metricKey: "mortgage_arrears",
      label: "Mortgage arrears",
      unit: "%",
      value: "1.62",
      previousValue: "1.20",
    });
    const pick = pickStatOfTheDay(
      [arrears],
      { mortgage_arrears: history([1.15, 1.17, 1.18, 1.19, 1.2]) },
      NOW
    );
    expect(pick).not.toBeNull();
    expect(pick!.angle).toBe("jump");
    expect(pick!.subtext).toContain("THE USUAL MOVE");
  });

  it("appends the unit to the value it hands the card", () => {
    const pick = pickStatOfTheDay(
      [metric({ value: "58.4", unit: "%" })],
      { auction_clearance: history([64, 63, 62, 61, 60]) },
      NOW
    );
    expect(pick!.value).toBe("58.4%");
  });

  it("leaves an already-formatted value alone when there is no unit", () => {
    const dwelling = metric({
      metricKey: "dwelling_value",
      label: "Nat'l dwelling value",
      unit: null,
      value: "$815,439",
      previousValue: "$818,000",
    });
    const pick = pickStatOfTheDay(
      [dwelling],
      { dwelling_value: history([830000, 826000, 822000, 819000, 818000]) },
      NOW
    );
    expect(pick!.value).toBe("$815,439");
  });

  it("picks the strongest angle across competing metrics", () => {
    const longStreak = metric({ value: "55" });
    const shortStreak = metric({
      metricKey: "unemployment",
      label: "Unemployment rate",
      unit: "%",
      value: "4.3",
      previousValue: "4.2",
    });
    const pick = pickStatOfTheDay(
      [shortStreak, longStreak],
      {
        auction_clearance: history([64, 63, 62, 61, 60, 59, 58, 57, 56]),
        unemployment: history([4.0, 4.1, 4.2]),
      },
      NOW
    );
    expect(pick!.metricKey).toBe("auction_clearance");
  });

  it("only ever returns a pick at or above the posting bar", () => {
    const pick = pickStatOfTheDay(
      [metric({ value: "58.4" })],
      { auction_clearance: history([64, 63, 62, 61, 60, 59.1]) },
      NOW
    );
    expect(pick!.score).toBeGreaterThanOrEqual(MIN_SCORE);
  });

  it("carries provenance through so the card can name its source", () => {
    const pick = pickStatOfTheDay(
      [metric({ source: "CoreLogic", sourceUrl: "https://example.com/hvi" })],
      { auction_clearance: history([64, 63, 62, 61, 60]) },
      NOW
    );
    expect(pick!.source).toBe("CoreLogic");
    expect(pick!.sourceUrl).toBe("https://example.com/hvi");
    expect(pick!.asOf).toEqual(new Date("2026-09-05T00:00:00Z"));
  });
});
