import { describe, expect, it } from "vitest";
import { comparisonPairKey } from "@shared/comparisonChanges";
import {
  COMPARISON_WATCH_KEY,
  parseComparisonWatches,
  readComparisonWatchValue,
  removeComparisonWatch,
  writeComparisonWatch,
  type ComparisonWatch,
  type WatchStorage,
} from "./comparisonWatches";

function storage(initial = ""): WatchStorage {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}
const watch = (marketA = "Brisbane", marketB = "Perth"): ComparisonWatch => ({
  marketA,
  marketB,
  baselineToken: "signed-token-placeholder-for-storage-tests",
  watchedAt: "2026-09-07T12:00:00.000Z",
});

describe("device comparison baselines", () => {
  it("retains the original baseline until replacement is explicitly requested", () => {
    const store = storage();
    expect(writeComparisonWatch(store, watch()).ok).toBe(true);
    const newer = {
      ...watch("Perth", "Brisbane"),
      baselineToken: "a-different-signed-token-placeholder",
    };
    expect(writeComparisonWatch(store, newer).ok).toBe(true);
    expect(parseComparisonWatches(store.getItem(COMPARISON_WATCH_KEY))[0]?.baselineToken).toBe(
      watch().baselineToken
    );
    expect(writeComparisonWatch(store, newer, true).ok).toBe(true);
    expect(parseComparisonWatches(store.getItem(COMPARISON_WATCH_KEY))[0]?.baselineToken).toBe(
      newer.baselineToken
    );
  });
  it("never silently evicts a saved baseline when the six slots are full", () => {
    const store = storage();
    for (let i = 0; i < 6; i++)
      expect(writeComparisonWatch(store, watch(`Market ${i}`)).ok).toBe(true);
    expect(writeComparisonWatch(store, watch("Adelaide")).ok).toBe(false);
    expect(parseComparisonWatches(store.getItem(COMPARISON_WATCH_KEY))).toHaveLength(6);
  });
  it("validates and bounds stored metadata without trusting arbitrary answer fields", () => {
    const valid = watch();
    expect(parseComparisonWatches("invalid JSON")).toEqual([]);
    expect(parseComparisonWatches("x".repeat(120_001))).toEqual([]);
    expect(
      parseComparisonWatches(
        JSON.stringify([
          valid,
          watch("perth", "brisbane"),
          { ...valid, answer: "Fabricated trusted answer" },
          { ...valid, watchedAt: "bad date" },
        ])
      )
    ).toEqual([valid]);
  });
  it("keeps unrelated pairs when removing a watch", () => {
    const store = storage();
    writeComparisonWatch(store, watch());
    writeComparisonWatch(store, watch("Adelaide"));
    expect(removeComparisonWatch(store, comparisonPairKey("Perth", "Brisbane"))).toBe(true);
    expect(
      parseComparisonWatches(store.getItem(COMPARISON_WATCH_KEY)).map((item) => item.marketA)
    ).toEqual(["Adelaide"]);
  });
  it("survives blocked reads and failed writes without claiming a successful save", () => {
    const blocked = {
      getItem: () => {
        throw new Error("Denied");
      },
      setItem: () => {
        throw new Error("Quota");
      },
    };
    expect(readComparisonWatchValue(blocked)).toBe("");
    expect(writeComparisonWatch(blocked, watch()).ok).toBe(false);
    expect(writeComparisonWatch(null, watch()).ok).toBe(false);
    expect(removeComparisonWatch(blocked, comparisonPairKey("Brisbane", "Perth"))).toBe(false);
  });
});
