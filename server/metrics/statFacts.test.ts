import { describe, expect, it } from "vitest";
import { buildStatFacts } from "./statFacts";
import type { SparkPoint } from "../og/sparkline";

function series(values: number[]): SparkPoint[] {
  return values.map((value, i) => ({ value, at: new Date(Date.UTC(2024, i, 1)) }));
}

const twelve = series([100, 104, 98, 110, 96, 102, 108, 101, 99, 106, 103, 112]);

describe("buildStatFacts", () => {
  it("writes every supporting figure in the shape of the headline one", () => {
    // A percentage metric must not sprout a supporting figure written as a
    // bare number, and a dollar one must not lose its prefix.
    const pct = buildStatFacts("4.3%", series([4.1, 4.4, 4.0, 4.6, 4.2, 4.3]), 0.2);
    for (const f of pct) {
      if (f.caption.startsWith("Readings")) continue;
      expect(f.figure).toContain("%");
      expect(f.figure).toMatch(/\d\.\d/); // one decimal, like the headline
    }
    const dollars = buildStatFacts(
      "$815,439",
      series([800000, 810000, 790000, 830000, 805000, 815439]),
      5439
    );
    expect(dollars[0]!.figure).toContain("$");
  });

  it("leads with the move, because that is the only part that is news", () => {
    const facts = buildStatFacts("112", twelve, 9);
    expect(facts[0]!.figure).toBe("+9");
    expect(facts[0]!.caption).toMatch(/^Up/);
  });

  it("says down when it went down, and writes the sign in", () => {
    // A minus at this size reads as a hyphen between two things.
    const facts = buildStatFacts("112", twelve, -9);
    expect(facts[0]!.figure.startsWith("−")).toBe(true);
    expect(facts[0]!.caption).toMatch(/^Down/);
  });

  it("omits the move rather than printing a change of nothing", () => {
    expect(buildStatFacts("112", twelve, 0)[0]!.caption).not.toMatch(/previous reading/);
    expect(buildStatFacts("112", twelve, null)[0]!.caption).not.toMatch(/previous reading/);
  });

  it("reports the range across the readings actually held", () => {
    const range = buildStatFacts("112", twelve, 9).find((f) => f.caption.startsWith("Range"))!;
    expect(range.figure).toBe("96 — 112");
  });

  it("refuses a range and an average on a series too short to have either", () => {
    // Four readings do not have a typical value; printing one would be a
    // statement about noise.
    const captions = buildStatFacts("112", series([100, 104, 98, 110]), 9).map((f) => f.caption);
    expect(captions.some((c) => c.startsWith("Range"))).toBe(false);
    expect(captions.some((c) => c.startsWith("Typical"))).toBe(false);
  });

  it("counts the archive, and dates it honestly", () => {
    const readings = buildStatFacts("112", twelve, 9, 9).find((f) =>
      f.caption.startsWith("Readings")
    )!;
    expect(readings.figure).toBe("12");
    expect(readings.caption).toContain("JAN 2024");
  });

  it("puts the archive last, because it is about us and not the metric", () => {
    const facts = buildStatFacts("112", twelve, 9, 9);
    expect(facts[facts.length - 1]!.caption).toMatch(/^Readings/);
  });

  it("stops at the number of figures the card has room for", () => {
    expect(buildStatFacts("112", twelve, 9, 2)).toHaveLength(2);
  });

  it("says nothing at all when the headline figure has no number in it", () => {
    expect(buildStatFacts("n/a", twelve, 9)).toEqual([]);
  });

  it("skips the range when every reading is identical", () => {
    // "100 — 100" is not a range, it is the same number twice.
    const captions = buildStatFacts("100", series([100, 100, 100, 100, 100, 100]), null).map(
      (f) => f.caption
    );
    expect(captions.some((c) => c.startsWith("Range"))).toBe(false);
  });
});
