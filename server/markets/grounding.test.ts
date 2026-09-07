import { describe, expect, it } from "vitest";
import { comparisonInputSchema } from "../../shared/marketComparison";
import {
  createIntelligenceShareToken,
  readIntelligenceShareToken,
} from "../core/intelligenceShare";
import { mentionsMarket, marketPassage } from "./evidence";
import { groundComparison, numbersGrounded } from "./grounding";
import { comparisonAnswer, comparisonEvidence, comparisonNow } from "./comparison.fixture";

function ground(answer: unknown = comparisonAnswer, sources = comparisonEvidence) {
  return groundComparison(answer, sources, "Brisbane", "Perth", comparisonNow);
}
describe("market comparison evidence boundaries", () => {
  it("keeps the current sourced view and caps sparse evidence at low confidence", () => {
    const result = ground();
    expect(result?.confidence).toBe("low");
    expect(result?.sources).toHaveLength(2);
    expect(result?.rows[0]?.edge).toBe("a");
    expect(result?.sources[0]).not.toHaveProperty("text");
  });
  it("rejects invented quotes, references, wrong-market attribution and unsupported numbers", () => {
    for (const change of [
      { sourceRef: 1, quote: "Brisbane house rents rose 9% over the year to August." },
      { sourceRef: 8, quote: comparisonAnswer.rows[0]!.marketA!.quote },
      { sourceRef: 2, quote: comparisonAnswer.rows[0]!.marketB!.quote },
    ]) {
      const answer = structuredClone(comparisonAnswer);
      answer.rows[0]!.marketA = change;
      expect(ground(answer)).toBeNull();
    }
    expect(ground({ ...comparisonAnswer, verdict: "Brisbane will rise 22%." })).toBeNull();
    const answer = structuredClone(comparisonAnswer);
    answer.rows[0]!.read = "The gap is 1%.";
    expect(ground(answer)).toBeNull();
  });
  it("does not let another row's numbers justify a local interpretation", () => {
    const answer = structuredClone(comparisonAnswer);
    answer.rows[0]!.read = "Prices are $4 million.";
    expect(ground(answer)).toBeNull();
    expect(numbersGrounded("$4m", "4% $4k")).toBe(false);
    expect(numbersGrounded("-4%", "+4%")).toBe(false);
    expect(numbersGrounded("4 million", "4 billion")).toBe(false);
  });
  it("blocks a winner when one side, recent evidence or usable citations are missing", () => {
    const answer = structuredClone(comparisonAnswer);
    answer.rows[0]!.marketB = null;
    expect(ground(answer)).toBeNull();
    for (const date of ["2024-01-01", "2026-12-01", "unknown"]) {
      const withheld = ground(
        comparisonAnswer,
        comparisonEvidence.map((source) => ({ ...source, date }))
      );
      expect(withheld?.rows[0]?.edge).toBe("unclear");
      expect(withheld?.verdict).toBe("No clear edge on the available evidence.");
      expect(withheld?.deskTake).not.toContain("leans Brisbane");
    }
    expect(ground({ ...comparisonAnswer, rows: [] })).toBeNull();
    expect(
      ground({ ...comparisonAnswer, rows: [...comparisonAnswer.rows, ...comparisonAnswer.rows] })
    ).toBeNull();
  });
  it("allows honest one-sided dimensions but does not convert them into a winner", () => {
    const row = comparisonAnswer.rows[0]!;
    const answer = {
      ...comparisonAnswer,
      rows: [
        {
          ...row,
          marketB: null,
          read: "Only Brisbane has a rental observation in this row.",
          edge: "unclear",
        },
        {
          ...row,
          dimension: "supply",
          marketA: null,
          marketB: { sourceRef: 2, quote: "Perth housing supply remains constrained." },
          read: "Only Perth has a supply observation in this row.",
          edge: "unclear",
        },
      ],
    };
    const result = ground(answer);
    expect(result?.confidence).toBe("low");
    expect(result?.verdict).toBe("No clear edge on the available evidence.");
  });
  it("round-trips the whole comparison in the existing signed share envelope", () => {
    const comparison = ground()!;
    const brief = {
      question: "Brisbane vs Perth",
      headline: "Brisbane vs Perth",
      answer: comparison.verdict,
      deskTake: comparison.deskTake,
      confidence: comparison.confidence,
      sourceCount: 2,
      sources: comparison.sources,
      signal: null,
      comparison,
    };
    const token = createIntelligenceShareToken(brief, comparisonNow);
    expect(readIntelligenceShareToken(token, comparisonNow)?.comparison).toEqual(comparison);
    expect(readIntelligenceShareToken(token + "x", comparisonNow)).toBeNull();
    const invalid = createIntelligenceShareToken(
      { ...brief, comparison: { ...comparison, rows: "untrusted" } as never },
      comparisonNow
    );
    expect(readIntelligenceShareToken(invalid, comparisonNow)).toBeNull();
  });
});
describe("local market retrieval", () => {
  it("uses whole place names, including multiword and Unicode places", () => {
    expect(mentionsMarket("Perthshire prices", "Perth")).toBe(false);
    expect(mentionsMarket("Macquarie lending", "Port Macquarie")).toBe(false);
    expect(mentionsMarket("Port Macquarie rents", "Port Macquarie")).toBe(true);
    expect(mentionsMarket("Perth, rents are rising.", "Perth")).toBe(true);
    expect(mentionsMarket("Côte homes", "Côte")).toBe(true);
  });
  it("retrieves a relevant late passage instead of the beginning of a long edition", () => {
    const text = "National credit backdrop. ".repeat(200) + "Perth house rents rose 3%.";
    expect(marketPassage(text, "Perth")).toContain("Perth house rents rose 3%.");
    expect(marketPassage("National credit is expanding.", "Perth")).toBeNull();
  });
  it("validates distinct bounded market inputs without accepting arbitrary markup", () => {
    expect(comparisonInputSchema.safeParse({ marketA: " Perth ", marketB: "perth" }).success).toBe(
      false
    );
    expect(comparisonInputSchema.safeParse({ marketA: "<script>", marketB: "Perth" }).success).toBe(
      false
    );
    expect(
      comparisonInputSchema.parse({ marketA: "Port   Macquarie", marketB: "Perth" }).marketA
    ).toBe("Port Macquarie");
  });
});
