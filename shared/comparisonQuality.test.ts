import { describe, expect, it } from "vitest";
import {
  basisTextIsQuoted,
  comparisonQuality,
  evidenceFreshness,
  observationPeriodEnd,
} from "./comparisonQuality";
import {
  comparisonAnswer,
  comparisonEvidence,
  comparisonNow,
} from "../server/markets/comparison.fixture";
import { groundComparison } from "../server/markets/grounding";
import {
  createIntelligenceShareToken,
  readIntelligenceShareToken,
} from "../server/core/intelligenceShare";
import { comparisonSnapshotSchema } from "./marketComparison";

const asOf = "2026-09-07";
const row = () => structuredClone(comparisonAnswer.rows[0]!);

describe("comparison criteria", () => {
  it("accepts explicitly matching recent criteria, including a percentage sign adjacent to a value", () => {
    expect(comparisonQuality(row(), comparisonEvidence, asOf)).toEqual({
      comparable: true,
      reasons: [],
    });
    expect(basisTextIsQuoted("%", "rents rose 4%")).toBe(true);
    expect(basisTextIsQuoted("house", "warehouse growth")).toBe(false);
  });
  it("explains missing data and mismatched property types without calling either market weaker", () => {
    const missing = row();
    delete missing.marketA!.basis;
    expect(comparisonQuality(missing, comparisonEvidence, asOf).reasons.join(" ")).toContain(
      "Not recorded"
    );
    const mixed = row();
    mixed.marketB!.basis!.segment = "unit";
    mixed.marketB!.quote = mixed.marketB!.quote.replace("house", "unit");
    expect(comparisonQuality(mixed, comparisonEvidence, asOf).reasons.join(" ")).toContain(
      "Different property"
    );
  });
  it("detects annual versus monthly growth even if the extracted end-month phrases match", () => {
    const mixed = row();
    mixed.marketA!.basis!.period = "August 2026";
    mixed.marketB!.basis!.period = "August 2026";
    mixed.marketB!.quote = mixed.marketB!.quote.replace("year", "month");
    expect(comparisonQuality(mixed, comparisonEvidence, asOf).reasons.join(" ")).toContain(
      "windows differ"
    );
  });
  it("does not use a recent publication to make old observations current", () => {
    const old = row();
    for (const observation of [old.marketA!, old.marketB!]) {
      observation.basis!.period = "year to August 2024";
      observation.quote = observation.quote.replace("2026", "2024");
    }
    expect(comparisonQuality(old, comparisonEvidence, asOf).reasons.join(" ")).toContain(
      "observations are older"
    );
  });
  it("blocks fabricated criteria and a future endpoint relative to the publication date", () => {
    const fabricated = row();
    fabricated.marketA!.basis!.measure = "vacancy rate";
    expect(comparisonQuality(fabricated, comparisonEvidence, asOf).reasons.join(" ")).toContain(
      "not explicit"
    );
    expect(
      groundComparison(
        { ...comparisonAnswer, rows: [fabricated] },
        comparisonEvidence,
        "Brisbane",
        "Perth",
        comparisonNow
      )
    ).toBeNull();
    const premature = comparisonEvidence.map((source) => ({ ...source, date: "2026-08-01" }));
    expect(comparisonQuality(row(), premature, asOf).reasons.join(" ")).toContain(
      "later than its source publication"
    );
  });
});

describe("explicit observation dates", () => {
  it("handles dated month, day, ISO and quarter endpoints, including a leap year", () => {
    expect(observationPeriodEnd("year to August 2026")).toBe(Date.UTC(2026, 7, 31));
    expect(observationPeriodEnd("week to 6 September 2026")).toBe(Date.UTC(2026, 8, 6));
    expect(observationPeriodEnd("2026-08-01 to 2026-08-31")).toBe(Date.UTC(2026, 7, 31));
    expect(observationPeriodEnd("2026-08-01 to 31 August 2026")).toBe(Date.UTC(2026, 7, 31));
    expect(observationPeriodEnd("Q2 2026")).toBe(Date.UTC(2026, 5, 30));
    expect(observationPeriodEnd("February 2024")).toBe(Date.UTC(2024, 1, 29));
  });
  it("does not guess a year or accept invalid dates", () => {
    expect(observationPeriodEnd("year to August")).toBeNull();
    expect(observationPeriodEnd("2026-02-30")).toBeNull();
    expect(observationPeriodEnd("31 April 2026")).toBeNull();
    expect(evidenceFreshness("2026-02-30", asOf)).toBe("unknown");
    expect(evidenceFreshness("2026-09-08", asOf)).toBe("future");
    expect(evidenceFreshness("2024-09-07", asOf)).toBe("older");
  });
});

describe("safe withheld views and signed compatibility", () => {
  it("withholds unmatched edges, removing the model's dependent winning narrative", () => {
    const unmatched = row();
    delete unmatched.marketA!.basis;
    const view = groundComparison(
      { ...comparisonAnswer, rows: [unmatched] },
      comparisonEvidence,
      "Brisbane",
      "Perth",
      comparisonNow
    )!;
    expect(view.rows[0]?.edge).toBe("unclear");
    expect(view.rows[0]?.read).not.toContain("Brisbane has");
    expect(view.verdict).toBe("No clear edge on the available evidence.");
    expect(view.deskTake).not.toContain("leans Brisbane");
  });
  it("preserves a qualified surviving edge and prevents an overall winner for conflicting advantages", () => {
    const listings = row();
    listings.dimension = "listings";
    listings.edge = "b";
    listings.read = "Perth has the stronger listings response in the recorded period.";
    for (const observation of [listings.marketA!, listings.marketB!]) {
      observation.quote = observation.quote.replace("rents", "listings");
      observation.basis!.measure = "listings";
    }
    const evidence = comparisonEvidence.map((source) => ({
      ...source,
      text:
        source.text + " " + (source.ref === 1 ? listings.marketA!.quote : listings.marketB!.quote),
    }));
    const mixed = groundComparison(
      { ...comparisonAnswer, rows: [row(), listings] },
      evidence,
      "Brisbane",
      "Perth",
      comparisonNow
    )!;
    expect(mixed.verdict).toBe("Different strengths. No clear overall edge.");
    expect(mixed.rows.map((item) => item.edge)).toEqual(["a", "b"]);
    delete listings.marketA!.basis;
    const partial = groundComparison(
      { ...comparisonAnswer, rows: [row(), listings] },
      evidence,
      "Brisbane",
      "Perth",
      comparisonNow
    )!;
    expect(partial.verdict).toBe("A qualified edge for Brisbane on the comparable evidence.");
    expect(partial.deskTake).toContain("rental conditions");
    expect(partial.deskTake).not.toContain("listings");
    expect(partial.rows[1]?.edge).toBe("unclear");
  });
  it("round-trips new criteria while preserving old signed snapshots without them", () => {
    const view = groundComparison(
      comparisonAnswer,
      comparisonEvidence,
      "Brisbane",
      "Perth",
      comparisonNow
    )!;
    for (const legacy of [false, true]) {
      const comparison = structuredClone(view);
      if (legacy)
        for (const item of comparison.rows) {
          if (item.marketA) delete item.marketA.basis;
          if (item.marketB) delete item.marketB.basis;
        }
      expect(comparisonSnapshotSchema.safeParse(comparison).success).toBe(true);
      const token = createIntelligenceShareToken(
        {
          question: "Brisbane vs Perth",
          headline: "Brisbane vs Perth",
          answer: comparison.verdict,
          deskTake: comparison.deskTake,
          confidence: comparison.confidence,
          sources: comparison.sources,
          sourceCount: 2,
          signal: null,
          comparison,
        },
        comparisonNow
      );
      expect(readIntelligenceShareToken(token, comparisonNow)?.comparison).toEqual(comparison);
    }
  });
});
