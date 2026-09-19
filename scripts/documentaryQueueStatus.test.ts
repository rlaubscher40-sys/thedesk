import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { documentaryQueueStatus } from "./lib/documentaryQueueStatus";

const ledger = JSON.parse(
  fs.readFileSync(new URL("../docs/documentary-editorial-queue.json", import.meta.url), "utf8")
);
const now = new Date("2026-09-16T23:00:00Z");

describe("documentary recovery queue", () => {
  it("continues existing work with explicit user release authorisation and honest review limitations", () => {
    const result = documentaryQueueStatus(ledger, now);
    expect(result.nextContinuation).toBe("triguboff-apartments");
    expect(result.runtimeLaunchGateReady).toBe(true);
    expect(result.verifiedReviewedUnpublishedCount).toBe(0);
    expect(result.newProductionNeeded).toBe(false);
    expect(result.episodes).toHaveLength(4);
    expect(
      result.episodes.every(
        (e) =>
          e.currentInputMatchesRecoveredExport && e.approval?.kind === "user-release-authorisation"
      )
    ).toBe(true);
    expect(result.episodes.find((e) => e.episodeId === "lowy-westfield")?.legacySlotExpired).toBe(
      true
    );
    expect(result.episodes.every((e) => Boolean(e.reservedSydneyDate))).toBe(true);
  });
  it("reports changed render inputs without updating the recovered export", () => {
    const changed = structuredClone(ledger);
    changed.episodes[0].export.inputHash = "a".repeat(64);
    expect(
      documentaryQueueStatus(changed, now).episodes[0]!.currentInputMatchesRecoveredExport
    ).toBe(false);
  });
  it.each(["episodeId", "export"])("rejects duplicate %s identities", (key) => {
    const changed = structuredClone(ledger);
    changed.episodes[1][key] = changed.episodes[0][key];
    expect(() => documentaryQueueStatus(changed, now)).toThrow(/Duplicate/);
  });
  it("rejects ordinary programme ownership, invented approval and receipt resets", () => {
    for (const change of [
      (e: any) => {
        e.family = "supply";
      },
      (e: any) => {
        e.review.approval = { kind: "human", reviewer: "Ruben" };
      },
      (e: any) => {
        delete e.review.approval.revoice;
      },
      (e: any) => {
        e.review.approval.revoice.scope = "Approve every future film";
      },
      (e: any) => {
        e.publication.date = "2026-09-17";
      },
      (e: any) => {
        e.publication.receiptStatus = "unpublished";
      },
      (e: any) => {
        e.publication.reservedSydneyDate = "2026-09-16";
      },
    ]) {
      const changed = structuredClone(ledger);
      change(changed.episodes[0]);
      expect(() => documentaryQueueStatus(changed, now)).toThrow();
    }
  });
  it("requires a valid clock", () => {
    expect(() => documentaryQueueStatus(ledger, new Date("invalid"))).toThrow(
      "Invalid status clock"
    );
  });
});
