import { describe, expect, it } from "vitest";
import {
  MIN_MONTHS_FOR_RANK,
  buildMonthlyReview,
  describeMove,
  monthLabel,
  previousMonth,
  readMonth,
  sydneyMonth,
  type HistoryPoint,
  type MetricMeta,
} from "./monthlyReview";

const NOW = new Date("2026-09-05T00:00:00Z");

function meta(o: Partial<MetricMeta> = {}): MetricMeta {
  return { metricKey: "asx200", label: "ASX 200", unit: null, groupKey: "MARKETS", ...o };
}

/** Two readings in a month: `open` on the 2nd, `close` on the 27th (Sydney). */
function month(m: string, open: number, close: number): HistoryPoint[] {
  return [
    { value: open, recordedAt: new Date(`${m}-02T02:00:00Z`) },
    { value: close, recordedAt: new Date(`${m}-27T02:00:00Z`) },
  ];
}

/** A run of ordinary months, each moving by `step`, ending before the target. */
function calmMonths(months: string[], start: number, step: number): HistoryPoint[] {
  let v = start;
  return months.flatMap((m) => {
    const pts = month(m, v, v + step);
    v += step;
    return pts;
  });
}

describe("sydneyMonth", () => {
  it("buckets a reading by the Sydney calendar, not UTC", () => {
    // 31 Aug 2026 23:00 UTC is already 1 September in Sydney. Bucketing on UTC
    // would file the first reading of September as the last of August and shift
    // both months' open and close.
    expect(sydneyMonth(new Date("2026-08-31T23:00:00Z"))).toBe("2026-09");
    expect(sydneyMonth(new Date("2026-08-31T05:00:00Z"))).toBe("2026-08");
  });
});

describe("previousMonth", () => {
  it("steps back a month", () => {
    expect(previousMonth("2026-08")).toBe("2026-07");
  });
  it("rolls back across a year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("monthLabel", () => {
  it("renders a readable label", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
  });
});

describe("buildMonthlyReview", () => {
  it("defaults to the last complete month, not the one in progress", () => {
    // Published on the 1st, a review covers the month that finished. Reporting
    // a partial month as a finished one would be wrong every time.
    const review = buildMonthlyReview([], {}, undefined, NOW);
    expect(review.month).toBe("2026-08");
    expect(review.label).toBe("August 2026");
  });

  it("ranks by a metric's own normal swing, not by percent change", () => {
    // The cash rate moves 35 basis points against a usual 5. The ASX moves 300
    // points, which in percent terms dwarfs it and in meaning does not.
    const metrics = [
      meta({ metricKey: "cash_rate", label: "RBA cash rate", unit: "%", groupKey: "MACRO" }),
      meta({ metricKey: "asx200", label: "ASX 200" }),
    ];
    const histories = {
      cash_rate: [
        ...month("2026-05", 4.0, 4.05),
        ...month("2026-06", 4.05, 4.1),
        ...month("2026-07", 4.1, 4.15),
        ...month("2026-08", 4.15, 4.5),
      ],
      asx200: calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 300).concat(
        month("2026-08", 8900, 9200)
      ),
    };
    const review = buildMonthlyReview(metrics, histories, "2026-08", NOW);
    // Cash rate: 0.35 against a usual 0.05 = 7x. ASX: 300 against a usual 300 = 1x.
    expect(review.movers[0]?.metricKey).toBe("cash_rate");
    expect(review.movers[0]?.unusualness).toBeCloseTo(7, 5);
  });

  it("puts a metric that broke a run of stillness above any ratio", () => {
    // The cash rate sits unchanged for months and then moves. Its usual monthly
    // move is zero, so there is no ratio to compute — and it is nonetheless the
    // most consequential thing that can happen in this basket. Dividing by zero
    // and dropping it would silently exclude the story of the month.
    const metrics = [
      meta({ metricKey: "cash_rate", label: "RBA cash rate", unit: "%" }),
      meta({ metricKey: "asx200", label: "ASX 200" }),
    ];
    const histories = {
      cash_rate: [
        ...month("2026-05", 4.0, 4.0),
        ...month("2026-06", 4.0, 4.0),
        ...month("2026-07", 4.0, 4.0),
        ...month("2026-08", 4.0, 4.25),
      ],
      // A genuinely huge month for the ASX by its own standards.
      asx200: calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 50).concat(
        month("2026-08", 8150, 9150)
      ),
    };
    const review = buildMonthlyReview(metrics, histories, "2026-08", NOW);
    expect(review.movers[0]?.metricKey).toBe("cash_rate");
    expect(review.movers[0]?.brokeStillness).toBe(true);
    expect(review.movers[0]?.unusualness).toBeNull();
    expect(readMonth(review)).toContain("after 3 months unchanged");
  });

  it("does not call a still metric broken when it stayed still", () => {
    const histories = {
      cash_rate: [
        ...month("2026-05", 4.0, 4.0),
        ...month("2026-06", 4.0, 4.0),
        ...month("2026-07", 4.0, 4.0),
        ...month("2026-08", 4.0, 4.0),
      ],
    };
    const metrics = [meta({ metricKey: "cash_rate", label: "RBA cash rate", unit: "%" })];
    const review = buildMonthlyReview(metrics, histories, "2026-08", NOW);
    expect(review.movers).toHaveLength(0);
    expect(review.unchanged[0]?.brokeStillness).toBe(false);
  });

  it("states percent-denominated metrics in points, never as a relative change", () => {
    // "The cash rate rose 8.75%" is technically true and reads as nonsense.
    const metrics = [meta({ metricKey: "cash_rate", label: "RBA cash rate", unit: "%" })];
    const histories = { cash_rate: [...month("2026-08", 4.0, 4.35)] };
    const move = buildMonthlyReview(metrics, histories, "2026-08", NOW).unranked[0]!;
    expect(move.changeKind).toBe("points");
    expect(move.changePercent).toBeNull();
    expect(describeMove(move)).toBe("+0.35 points");
  });

  it("states level metrics in percent", () => {
    const histories = { asx200: [...month("2026-08", 8000, 8400)] };
    const move = buildMonthlyReview([meta()], histories, "2026-08", NOW).unranked[0]!;
    expect(move.changeKind).toBe("percent");
    expect(move.changePercent).toBeCloseTo(5, 5);
    expect(describeMove(move)).toBe("+5.0%");
  });

  it("holds back a metric without enough months behind it", () => {
    // One prior month cannot establish what a normal month looks like.
    const histories = { asx200: [...month("2026-07", 8000, 8100), ...month("2026-08", 8100, 9000)] };
    const review = buildMonthlyReview([meta()], histories, "2026-08", NOW);
    expect(review.movers).toHaveLength(0);
    expect(review.unranked).toHaveLength(1);
    expect(review.unranked[0]?.monthsOfHistory).toBeLessThan(MIN_MONTHS_FOR_RANK);
  });

  it("never measures a metric against the month being reviewed", () => {
    // If the target month leaked into its own baseline, an extraordinary move
    // would raise the bar it is being judged against and rank as ordinary.
    const histories = {
      asx200: calmMonths(["2026-04", "2026-05", "2026-06", "2026-07"], 8000, 100).concat(
        month("2026-08", 8400, 9400)
      ),
    };
    const move = buildMonthlyReview([meta()], histories, "2026-08", NOW).movers[0]!;
    expect(move.monthsOfHistory).toBe(4);
    expect(move.unusualness).toBeCloseTo(10, 5);
  });

  it("reports a metric that did not move rather than dropping it", () => {
    const histories = {
      asx200: calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 100).concat(
        month("2026-08", 8300, 8300)
      ),
    };
    const review = buildMonthlyReview([meta()], histories, "2026-08", NOW);
    expect(review.movers).toHaveLength(0);
    expect(review.unchanged.map((m) => m.metricKey)).toEqual(["asx200"]);
  });

  it("skips a month holding a single reading instead of calling it flat", () => {
    // One reading is a gap in the data, not a fact about the market.
    const histories = {
      asx200: [
        ...calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 100),
        { value: 8300, recordedAt: new Date("2026-08-10T02:00:00Z") },
      ],
    };
    const review = buildMonthlyReview([meta()], histories, "2026-08", NOW);
    expect(review.movers).toHaveLength(0);
    expect(review.unchanged).toHaveLength(0);
    expect(review.unranked).toHaveLength(0);
  });

  it("collapses repeat readings taken on the same day", () => {
    // A re-run on the 27th must not become the month's close twice over, nor
    // count as an extra day of movement.
    const histories = {
      asx200: [
        ...calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 100),
        { value: 8300, recordedAt: new Date("2026-08-02T02:00:00Z") },
        { value: 9000, recordedAt: new Date("2026-08-27T02:00:00Z") },
        { value: 8500, recordedAt: new Date("2026-08-27T09:00:00Z") },
      ],
    };
    const move = buildMonthlyReview([meta()], histories, "2026-08", NOW).movers[0]!;
    // Last reading of the 27th wins, so the close is 8500 and not 9000.
    expect(move.close).toBe(8500);
  });

  it("keeps the leftover lists in a stable order", () => {
    const histories = {
      asx200: [...month("2026-08", 8000, 8000)],
      audusd: [...month("2026-08", 0.65, 0.65)],
    };
    const metrics = [meta({ metricKey: "audusd", label: "AUD / USD" }), meta()];
    const review = buildMonthlyReview(metrics, histories, "2026-08", NOW);
    expect(review.unchanged.map((m) => m.label)).toEqual(["ASX 200", "AUD / USD"]);
  });
});

describe("readMonth", () => {
  it("says so when there are no readings at all", () => {
    expect(readMonth(buildMonthlyReview([], {}, "2026-08", NOW))).toContain("No readings recorded");
  });

  it("refuses to rank a basket without the history to rank it", () => {
    const histories = { asx200: [...month("2026-08", 8000, 9000)] };
    const read = readMonth(buildMonthlyReview([meta()], histories, "2026-08", NOW));
    expect(read).toContain("enough history");
  });

  it("calls a quiet month quiet instead of promoting the biggest small move", () => {
    // Every metric inside its own normal range is a real finding. Dressing the
    // largest of several ordinary moves as a story is how a data franchise
    // stops being worth reading.
    const histories = {
      asx200: calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 100).concat(
        month("2026-08", 8300, 8410)
      ),
    };
    const read = readMonth(buildMonthlyReview([meta()], histories, "2026-08", NOW));
    expect(read).toContain("A quiet August 2026");
  });

  it("leads with the mover once it clears its own normal range", () => {
    const histories = {
      asx200: calmMonths(["2026-05", "2026-06", "2026-07"], 8000, 100).concat(
        month("2026-08", 8300, 8800)
      ),
    };
    const read = readMonth(buildMonthlyReview([meta()], histories, "2026-08", NOW));
    expect(read).toContain("ASX 200 moved +6.0%");
    expect(read).toContain("times its usual month");
  });
});
