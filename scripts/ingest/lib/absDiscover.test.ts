import { describe, expect, it } from "vitest";
import { rankFlows, scoreFlow, withinExpected, type Dataflow } from "./absDiscover";

const flow = (id: string, name: string): Dataflow => ({
  id,
  name,
  agency: "ABS",
  version: "1.0.0",
});

const CATALOGUE = [
  flow("LF", "Labour Force, Australia"),
  flow("LF_DETAIL", "Labour Force, Australia, Detailed Quarterly"),
  flow("CPI", "Consumer Price Index, Australia"),
  flow("NIM", "Net Interstate Migration, States and Territories"),
  flow("ERP", "National, State and Territory Population"),
];

describe("scoreFlow", () => {
  it("weights the most distinctive term highest", () => {
    // The caller lists the distinctive word first, so a flow matching
    // "migration" must beat one matching only "australia".
    const spec = {
      terms: ["migration", "australia"],
      expectRange: [-1e6, 1e6] as [number, number],
    };
    expect(scoreFlow(CATALOGUE[3]!, spec)).toBeGreaterThan(scoreFlow(CATALOGUE[0]!, spec));
  });

  it("zeroes a flow carrying an excluded word", () => {
    // Exclusion is a statement that this is the wrong flow, not a weaker one.
    const spec = {
      terms: ["labour force"],
      exclude: ["detailed"],
      expectRange: [0, 100] as [number, number],
    };
    expect(scoreFlow(CATALOGUE[1]!, spec)).toBe(0);
    expect(scoreFlow(CATALOGUE[0]!, spec)).toBeGreaterThan(0);
  });

  it("matches on the id as well as the name", () => {
    const spec = { terms: ["nim"], expectRange: [0, 1] as [number, number] };
    expect(scoreFlow(CATALOGUE[3]!, spec)).toBeGreaterThan(0);
  });
});

describe("rankFlows", () => {
  it("drops flows that match nothing", () => {
    const ranked = rankFlows(CATALOGUE, {
      terms: ["migration"],
      expectRange: [0, 1] as [number, number],
    });
    expect(ranked.map((f) => f.id)).toEqual(["NIM"]);
  });

  it("prefers the headline series over a niche cut on a tie", () => {
    // Both match "labour force"; the shorter name is the headline one.
    const ranked = rankFlows(CATALOGUE, {
      terms: ["labour force"],
      expectRange: [0, 100] as [number, number],
    });
    expect(ranked[0]!.id).toBe("LF");
  });

  it("returns nothing rather than a bad guess when no flow matches", () => {
    expect(
      rankFlows(CATALOGUE, { terms: ["cryptocurrency"], expectRange: [0, 1] as [number, number] })
    ).toEqual([]);
  });
});

describe("withinExpected", () => {
  it("accepts a plausible reading", () => {
    expect(withinExpected(4.3, [2, 15])).toBe(true);
  });

  it("rejects a reading that cannot be this metric", () => {
    // This is the check that separates the right series from a
    // plausible-looking neighbour. An index level of 137 is not an
    // unemployment rate, however well the flow name matched.
    expect(withinExpected(137.2, [2, 15])).toBe(false);
  });

  it("treats the bounds as inclusive", () => {
    expect(withinExpected(2, [2, 15])).toBe(true);
    expect(withinExpected(15, [2, 15])).toBe(true);
  });
});
