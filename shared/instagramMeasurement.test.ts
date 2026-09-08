import { describe, expect, it } from "vitest";
import { needsInsightRefresh, inInsightWindow, type MeasuredPost } from "./instagramMeasurement";
const now = new Date("2026-09-08T12:00:00Z");
const row = (o: Partial<MeasuredPost> = {}): MeasuredPost => ({
  createdAt: "2026-09-07T00:00:00Z",
  metricsFetchedAt: null,
  reach: null,
  likes: null,
  comments: null,
  saved: null,
  shares: null,
  ...o,
});
const complete = { reach: 10, likes: 0, comments: 0, saved: 0, shares: 0 };
describe("bounded insights collection", () => {
  it("waits for a full day, retries missing data for seven days and rejects invalid/future dates", () => {
    expect(needsInsightRefresh(row(), now)).toBe(true);
    for (const createdAt of [
      "2026-09-08T00:00:00Z",
      "2026-08-31T00:00:00Z",
      "invalid",
      "2026-09-09T00:00:00Z",
      null,
    ])
      expect(needsInsightRefresh(row({ createdAt }), now)).toBe(false);
  });
  it("replaces early readings but freezes complete first-day snapshots", () => {
    expect(
      needsInsightRefresh(row({ ...complete, metricsFetchedAt: "2026-09-07T01:00:00Z" }), now)
    ).toBe(true);
    expect(
      needsInsightRefresh(row({ ...complete, metricsFetchedAt: "2026-09-08T01:00:00Z" }), now)
    ).toBe(false);
    expect(
      needsInsightRefresh(
        row({ ...complete, saved: null, metricsFetchedAt: "2026-09-08T01:00:00Z" }),
        now
      )
    ).toBe(true);
  });
  it("can recover a late snapshot for the raw list without calling it comparable", () => {
    const late = row({
      ...complete,
      createdAt: "2026-09-04T00:00:00Z",
      metricsFetchedAt: "2026-09-08T00:00:00Z",
    });
    expect(needsInsightRefresh(late, now)).toBe(false);
    expect(inInsightWindow(late)).toBe(false);
  });
  it("accepts real zeroes and enforces exact observation-age boundaries", () => {
    const r = row({ ...complete, reach: 0, metricsFetchedAt: "2026-09-08T00:00:00Z" });
    expect(needsInsightRefresh(r, now)).toBe(false);
    expect(inInsightWindow(r)).toBe(true);
    expect(inInsightWindow({ ...r, metricsFetchedAt: "2026-09-09T00:00:00Z" })).toBe(false);
    expect(inInsightWindow({ ...r, metricsFetchedAt: "2026-09-06T00:00:00Z" })).toBe(false);
  });
});
