import { describe, expect, it } from "vitest";
import { compareIntelligenceSnapshots, comparisonPairKey } from "./comparisonChanges";
import {
  comparisonAnswer,
  comparisonEvidence,
  comparisonNow,
} from "../server/markets/comparison.fixture";
import { groundComparison } from "../server/markets/grounding";

const view = () =>
  groundComparison(comparisonAnswer, comparisonEvidence, "Brisbane", "Perth", comparisonNow)!;

describe("comparison change summaries", () => {
  it("ignores reordered references, sentence styling and refreshed wording", () => {
    const before = view();
    const after = structuredClone(before);
    after.asOf = "2026-09-08";
    after.verdict = "Different wording of the same qualified view.";
    after.rows[0]!.read = "Rewritten interpretation with the same directional call.";
    after.sources.reverse();
    const oldRef = after.rows[0]!.marketA!.sourceRef;
    after.rows[0]!.marketA!.sourceRef = 7;
    after.sources.find((source) => source.ref === oldRef)!.ref = 7;
    after.rows[0]!.marketA!.quote = after.rows[0]!.marketA!.quote.replaceAll(" ", "  ");
    const change = compareIntelligenceSnapshots(before, after)!;
    expect(change.evidenceChanged).toBe(false);
    expect(change.callChanged).toBe(false);
    expect(change.dimensions).toEqual([]);
  });
  it("does not manufacture a flipped call when the pair order reverses", () => {
    const before = view();
    const after = structuredClone(before);
    [after.marketA, after.marketB] = [after.marketB, after.marketA];
    for (const row of after.rows) {
      [row.marketA, row.marketB] = [row.marketB, row.marketA];
      row.edge = row.edge === "a" ? "b" : row.edge === "b" ? "a" : "unclear";
    }
    const changes = compareIntelligenceSnapshots(before, after)!;
    expect(changes.evidenceChanged).toBe(false);
    expect(changes.callChanged).toBe(false);
    expect(comparisonPairKey(" Brisbane  ", "Perth")).toBe(comparisonPairKey("perth", "brisbane"));
  });
  it("distinguishes changed interpretation from changed selected evidence", () => {
    const before = view();
    const after = structuredClone(before);
    after.rows[0]!.edge = "unclear";
    const changes = compareIntelligenceSnapshots(before, after)!;
    expect(changes.callChanged).toBe(true);
    expect(changes.evidenceChanged).toBe(false);
    expect(changes.dimensions[0]).toMatchObject({
      before: "Brisbane",
      after: null,
      edgeChanged: true,
    });
  });
  it("tracks changed quotations and source selection without calculating price movements", () => {
    const before = view();
    const after = structuredClone(before);
    after.rows[0]!.marketA!.quote = "Brisbane house rents were unchanged in the new report.";
    after.sources[0]!.date = "2026-09-07";
    const changes = compareIntelligenceSnapshots(before, after)!;
    expect(changes.evidenceChanged).toBe(true);
    expect(changes.callChanged).toBe(false);
    expect(changes.sourceRecordsAdded).toBe(1);
    expect(changes.sourceRecordsRemoved).toBe(1);
    expect(changes).not.toHaveProperty("priceChange");
  });
  it("handles added and missing dimensions, confidence changes and unrelated pairs", () => {
    const before = view();
    const after = structuredClone(before);
    after.rows = [];
    after.confidence = "medium";
    expect(compareIntelligenceSnapshots(before, after)?.dimensions[0]?.kind).toBe("removed");
    expect(compareIntelligenceSnapshots(after, before)?.dimensions[0]?.kind).toBe("added");
    expect(compareIntelligenceSnapshots(before, after)?.confidenceChanged).toBe(true);
    after.marketB = "Adelaide";
    expect(compareIntelligenceSnapshots(before, after)).toBeNull();
  });
});
