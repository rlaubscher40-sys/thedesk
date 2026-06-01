import { describe, it, expect } from "vitest";
import { bestMatch, jaccard, titleTokens, titlesMatch } from "./textSimilarity";

describe("titleTokens", () => {
  it("drops stopwords, short words and punctuation", () => {
    const t = titleTokens("The RBA holds the cash rate at 4.35%");
    expect(t.has("rba")).toBe(true);
    expect(t.has("cash")).toBe(true);
    expect(t.has("rate")).toBe(true);
    expect(t.has("the")).toBe(false);
    expect(t.has("at")).toBe(false);
  });
});

describe("jaccard / titlesMatch", () => {
  it("scores overlapping headlines high and disjoint ones low", () => {
    const a = titleTokens("RBA holds cash rate at 4.35 percent third meeting");
    const b = titleTokens("RBA holds cash rate at 4.35 percent third meeting in row");
    const c = titleTokens("Federal budget deficit widens to 28 billion dollars");
    expect(jaccard(a, b)).toBeGreaterThan(0.6);
    expect(jaccard(a, c)).toBeLessThan(0.1);
    expect(titlesMatch(a, b, 4, 0.4)).toBe(true);
    expect(titlesMatch(a, c, 4, 0.4)).toBe(false);
  });
});

describe("bestMatch", () => {
  const candidates = [
    { value: { id: 1 }, tokens: titleTokens("RBA holds cash rate at 4.35 percent for third meeting") },
    { value: { id: 2 }, tokens: titleTokens("Sydney auction clearance climbs above 70 percent") },
    { value: { id: 3 }, tokens: titleTokens("Federal budget deficit widens sharply") },
  ];

  it("returns the most similar candidate above the thresholds", () => {
    const target = titleTokens("RBA keeps cash rate on hold at 4.35 percent, third meeting");
    expect(bestMatch(target, candidates)).toEqual({ id: 1 });
  });

  it("returns null when nothing clears the threshold (a genuinely new story)", () => {
    const target = titleTokens("APRA unveils new capital buffer for regional banks");
    expect(bestMatch(target, candidates)).toBeNull();
  });

  it("does not link on a single shared common token", () => {
    const target = titleTokens("Melbourne rents climb as vacancy tightens");
    // shares only "climb"/"percent"-ish at most; below minShared
    expect(bestMatch(target, candidates)).toBeNull();
  });
});
