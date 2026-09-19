import { describe, expect, it } from "vitest";
import { summariseReelLearning, type ReelLearningRow } from "./reelLearning";
const row = (patch: Partial<ReelLearningRow> = {}): ReelLearningRow => ({
  postId: "1",
  family: "rents",
  recipe: "rent-comparison",
  profile: "newsreader-v2-briefing",
  voice: "elevenlabs/ruben/1",
  seconds: 35,
  createdAt: "2026-09-01T00:00:00Z",
  metricsFetchedAt: "2026-09-02T01:00:00Z",
  reach: 100,
  saved: 2,
  shares: 1,
  ...patch,
});
describe("Reel audience cohorts", () => {
  it("separates age, recipe, voice, delivery profile and duration rather than inventing a winner", () => {
    const report = summariseReelLearning([
      row(),
      row({ postId: "2", recipe: "rent-change" }),
      row({ postId: "3", voice: "local-kokoro/bm_fable/1" }),
      row({ postId: "4", profile: "delivery-unrecorded" }),
      row({ postId: "5", seconds: 60 }),
      row({ postId: "6", metricsFetchedAt: "2026-09-02T07:00:00Z" }),
    ]);
    expect(report.cohorts).toHaveLength(6);
    expect(
      report.cohorts.every((c) => c.posts === 1 && c.nextAction.includes("at least five"))
    ).toBe(true);
  });
  it("uses per-post medians and separate available samples; missing is not zero", () => {
    const report = summariseReelLearning([
      row(),
      row({ postId: "2", reach: 1000, saved: 1, shares: null }),
      row({ postId: "3", saved: 0, shares: 0 }),
    ]);
    expect(report.cohorts[0]).toMatchObject({
      posts: 3,
      savesPerThousand: 1,
      savesSamples: 3,
      sharesPerThousand: 5,
      sharesSamples: 2,
    });
  });
  it("excludes absent provenance, unusable reach and late reads, and deduplicates IDs", () => {
    const report = summariseReelLearning([
      row(),
      row(),
      row({ postId: "2", recipe: null }),
      row({ postId: "3", reach: null }),
      row({ postId: "4", reach: 0 }),
      row({ postId: "5", metricsFetchedAt: "2026-09-03T00:00:00Z" }),
      row({ postId: "6", metricsFetchedAt: null }),
    ]);
    expect(report.excluded).toEqual({
      duplicate: 1,
      noProvenance: 1,
      noReach: 2,
      outsideWindow: 2,
    });
    expect(report.cohorts[0]?.posts).toBe(1);
  });
  it("keeps the coherent first-day snapshot when late retries replace raw counts", () => {
    const report = summariseReelLearning([
      row({
        metricsFetchedAt: "2026-09-06T00:00:00Z",
        reach: 9000,
        saved: 500,
        firstDayMetrics: { capturedAtMs: Date.parse("2026-09-02T01:00:00Z"), reach: 100, saved: 3 },
      }),
    ]);
    expect(report.cohorts[0]).toMatchObject({
      medianReach: 100,
      savesPerThousand: 30,
      sharesSamples: 0,
      sharesPerThousand: null,
    });
  });
});
