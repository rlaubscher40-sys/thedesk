import { describe, expect, it } from "vitest";
import { readFormats, summariseFormats, type InsightRow } from "./instagramInsights";
const row = (o: Partial<InsightRow> = {}): InsightRow => ({
  postType: "reel",
  likes: 10,
  comments: 2,
  reach: 1000,
  saved: 20,
  shares: 5,
  createdAt: "2026-09-01T00:00:00Z",
  metricsFetchedAt: "2026-09-02T06:00:00Z",
  ...o,
});
const summary = (rows: InsightRow[]) => summariseFormats(rows).find((s) => s.postType === "reel")!;
describe("first-day format review", () => {
  it("keeps the first-day cohort after late recovery without mixing observation ages", () => {
    const s = summary([
      row({
        metricsFetchedAt: "2026-09-05T00:00:00Z",
        reach: 9000,
        saved: 100,
        shares: 80,
        firstDayMetrics: {
          capturedAtMs: Date.parse("2026-09-02T06:00:00Z"),
          reach: 100,
          saved: 2,
          shares: null,
          likes: 0,
          comments: null,
        },
      }),
    ]);
    expect(s).toMatchObject({
      measured: 1,
      medianReach: 100,
      savesPer1k: 20,
      sharesPer1k: null,
      sharesSamples: 0,
      engagementSamples: 0,
    });
  });
  it("rejects malformed or out-of-window archived readings and keeps legacy readings usable", () => {
    for (const firstDayMetrics of [
      null,
      {},
      "invalid",
      [],
      { capturedAtMs: Date.parse("2026-09-04T00:00:00Z"), reach: 100 },
      { capturedAtMs: Date.parse("2026-09-02T06:00:00Z"), reach: -1 },
    ]) {
      expect(summary([row({ firstDayMetrics })]).medianReach).toBe(1000);
      expect(
        summary([row({ firstDayMetrics, metricsFetchedAt: "2026-09-05T00:00:00Z" })]).measured
      ).toBe(0);
    }
  });
  it("includes every format without manufacturing data", () => {
    expect(summariseFormats([])).toHaveLength(7);
    expect(summary([])).toMatchObject({
      measured: 0,
      awaiting: 0,
      excluded: 0,
      savesPer1k: null,
      savesSamples: 0,
    });
  });
  it("compares only known 24–48-hour snapshots", () => {
    const s = summary([
      row(),
      row({ metricsFetchedAt: "2026-09-01T01:00:00Z" }),
      row({ metricsFetchedAt: "2026-09-03T00:00:00Z" }),
      row({ createdAt: null }),
      row({ metricsFetchedAt: "invalid" }),
      row({ metricsFetchedAt: null }),
    ]);
    expect(s).toMatchObject({ measured: 1, excluded: 4, awaiting: 1, savesPer1k: 20 });
  });
  it("normalises each post before taking a median", () => {
    const s = summary([
      row({ reach: 10000, saved: 100 }),
      row({ reach: 1000, saved: 20 }),
      row({ reach: 100, saved: 30 }),
    ]);
    expect(s.savesPer1k).toBe(20);
    expect(s.savesSamples).toBe(3);
  });
  it("reports each metric's sample and never treats missing comments as zero", () => {
    const s = summary([row(), row({ saved: null }), row({ shares: null, comments: null })]);
    expect(s).toMatchObject({
      measured: 3,
      savesSamples: 2,
      sharesSamples: 2,
      engagementSamples: 2,
    });
    expect(summary([row({ saved: null })]).savesPer1k).toBeNull();
    expect(summary([row({ saved: 0 })]).savesPer1k).toBe(0);
  });
  it("retains genuine zero reach but never divides by it", () => {
    expect(summary([row({ reach: 0, saved: 0, shares: 0 })])).toMatchObject({
      measured: 1,
      medianReach: 0,
      savesPer1k: null,
      savesSamples: 0,
    });
  });
  it("excludes invalid counts instead of displaying NaN or negative rates", () => {
    for (const reach of [-1, NaN, Infinity, 1.5])
      expect(summary([row({ reach })]).measured).toBe(0);
    for (const saved of [-1, NaN, Infinity, 1.5])
      expect(summary([row({ saved })]).savesPer1k).toBeNull();
  });
  it("does not announce winners, infinite ratios or statistical conclusions", () => {
    for (const saved of [0, 1, 1000]) {
      const rows = Array.from({ length: 4 }, () => row({ saved })).concat(
        Array.from({ length: 4 }, () => row({ postType: "stat", saved: 0 }))
      );
      const text = readFormats(summariseFormats(rows));
      expect(text).toContain("exploratory observations");
      expect(text).not.toMatch(/Infinity|NaN|earning|running level|start meaning something/);
    }
    expect(readFormats(summariseFormats([]))).toContain("No comparable first-day snapshots");
  });
});
