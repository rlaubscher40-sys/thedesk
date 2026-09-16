import { describe, expect, it } from "vitest";
import { parseSdmxCsv } from "../../scripts/ingest/lib/absApi";
import { observationsToHistory } from "../../scripts/ingest/lib/backfill";
import { buildMonthlyReview } from "./monthlyReview";

/**
 * Official API observations remain useful history, but this legacy history
 * shape cannot distinguish reference periods from daily collection dates.
 * Release series must stay out of monthly rankings until that distinction is
 * preserved in the storage and review contract.
 */
describe("API response to monthly review", () => {
  it("retains official history without ranking an ambiguous release series", () => {
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

    expect(history.length).toBeGreaterThan(70);
    expect(review.movers).toEqual([]);
    expect(review.unchanged).toEqual([]);
    expect(review.unranked).toEqual([]);
  });
});
