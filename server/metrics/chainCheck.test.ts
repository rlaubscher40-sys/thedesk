import { describe, expect, it } from "vitest";
import { parseSdmxCsv } from "../../scripts/ingest/lib/absApi";
import { observationsToHistory } from "../../scripts/ingest/lib/backfill";
import { buildMonthlyReview, describeReach, readMonth } from "./monthlyReview";

/**
 * The whole point of moving to the API, exercised in one test: an SDMX-CSV
 * response becomes history, and that history lets the review make the claim
 * the series exists to make.
 */
describe("API response to a since-when claim", () => {
  it("turns years of official observations into a dated reach claim", () => {
    // Unemployment, monthly, drifting gently for years and then dropping hard.
    const rows = ["REGION,TIME_PERIOD,OBS_VALUE"];
    let v = 5.0;
    for (let y = 2020; y <= 2025; y++) {
      for (let m = 1; m <= 12; m++) {
        // One notable fall in 2022, so there is something to be "since".
        v += y === 2022 && m === 6 ? -0.8 : 0.02;
        rows.push(`AUS,${y}-${String(m).padStart(2, "0")},${v.toFixed(2)}`);
      }
    }
    // The month under review: a bigger fall than anything since that 2022 drop.
    v -= 0.5;
    rows.push(`AUS,2026-01,${v.toFixed(2)}`);

    const observations = parseSdmxCsv(rows.join("\n"));
    expect(observations.length).toBeGreaterThan(70);

    const history = observationsToHistory(observations);
    const review = buildMonthlyReview(
      [{ metricKey: "unemployment", label: "Unemployment rate", unit: "%", groupKey: "LABOUR" }],
      { unemployment: history },
      "2026-01",
      new Date("2026-02-01T00:00:00Z")
    );

    const move = review.movers[0]!;
    expect(move.metricKey).toBe("unemployment");
    // Years of history, from one API call, rather than the months we would
    // have accumulated by waiting.
    expect(move.monthsOfHistory).toBeGreaterThan(60);
    // No publication lag is set here, so a move is attributed to the period it
    // describes: the June observation, not the July release that carried it.
    expect(move.biggestSince).toBe("2022-06");
    expect(describeReach(move)).toBe("biggest fall since June 2022");
    expect(readMonth(review)).toContain("biggest fall since June 2022");
    // And it is still stated in points, because it is a percent metric.
    expect(readMonth(review)).toContain("points");
  });
});
