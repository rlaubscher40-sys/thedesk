import { describe, expect, it } from "vitest";
import type { AskContextSource } from "../prompts/ask";
import {
  deduplicateAnswerRefs,
  numberAskEvidence,
  packAskEvidence,
  requestedSourceLimit,
  validateAnswerRefs,
} from "./evidencePolicy";

const source = (ref: number, extra: Partial<AskContextSource> = {}): AskContextSource => ({
  ref,
  kind: "feed",
  title: "Building approvals",
  date: "2026-07-01",
  text: "Approvals are reported for July 2026.",
  ...extra,
});
const answer = {
  headline: "Approvals",
  answer: "The July observation. [Source 12]",
  whyItMatters: "Context",
  deskTake: "Unknown completions",
  whatWouldChangeOurMind: "Completion data",
  signals: [],
  sourceRefs: [12],
};

describe("Ask evidence limits", () => {
  it("uses structured records for a named dated observation instead of editorial or article context", () => {
    const rows = [
      source(1, { kind: "metric" }),
      source(25, { kind: "edition" }),
      source(26),
      source(27, { kind: "metric" }),
    ];
    expect(
      packAskEvidence("What do building approvals in July 2026 mean?", rows, 8)!.map(
        (row) => row.ref
      )
    ).toEqual([1, 27]);
    expect(
      packAskEvidence("What do editions say about building approvals?", rows, 8)!.some(
        (row) => row.kind === "edition"
      )
    ).toBe(true);
  });
  it("numbers a sparse selection consecutively without changing source identity or date", () => {
    const numbered = numberAskEvidence(
      [source(1), source(29), source(31)],
      [
        { ref: 1, href: "/one", date: "2026-07-01" },
        { ref: 29, href: "/twenty-nine", date: "2025-06-30" },
        { ref: 31, href: "/thirty-one", date: "2026-06-30" },
      ]
    );
    expect(numbered.map((entry) => entry.source.ref)).toEqual([1, 2, 3]);
    expect(numbered[1]!.metadata).toEqual({ ref: 2, href: "/twenty-nine", date: "2025-06-30" });
  });
  it.each([
    "Use at most three dated sources",
    "Up to 3 sources",
    "Cite three references",
    "Use 3 verified sources",
  ])("honours %s", (question) => {
    expect(requestedSourceLimit(question)).toBe(3);
  });
  it("does not confuse dwelling counts, dates or a larger request with an allowable source cap", () => {
    expect(requestedSourceLimit("Rents for 3 bedrooms in 2026")).toBe(8);
    expect(requestedSourceLimit("Use 20 sources")).toBe(8);
    expect(requestedSourceLimit("Use zero sources")).toBe(8);
  });
  it("keeps local periods and the leading metric while bounding the supplied evidence", () => {
    const rows = [
      source(1, { category: "LOCAL DATA", kind: "metric" }),
      source(2, { category: "LOCAL DATA", kind: "metric" }),
      source(3, { kind: "metric" }),
      ...Array.from({ length: 30 }, (_, i) => source(i + 4)),
    ];
    expect(packAskEvidence("Building approvals", rows, 8)!.map((s) => s.ref)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(packAskEvidence("Building approvals", rows, 1)).toBeNull();
  });
  it("retains original reference IDs after ranking", () => {
    const rows = [source(4, { title: "Unrelated business", text: "Unrelated" }), source(12)];
    expect(packAskEvidence("Building approvals", rows, 3)!.map((s) => s.ref)).toEqual([12]);
    expect(() => validateAnswerRefs(answer, [source(12)], 3)).not.toThrow();
  });
  it("deduplicates repeats without dropping distinct or unknown references", () => {
    expect(deduplicateAnswerRefs({ ...answer, sourceRefs: Array(12).fill(12) })).toMatchObject({
      sourceRefs: [12],
    });
    expect(deduplicateAnswerRefs({ ...answer, sourceRefs: [12, 999, 12] })).toMatchObject({
      sourceRefs: [12, 999],
    });
    expect(() =>
      validateAnswerRefs({ ...answer, sourceRefs: [12, 999] }, [source(12)], 3)
    ).toThrow();
  });
  it("rejects undeclared inline sources and a user's exceeded limit", () => {
    expect(() =>
      validateAnswerRefs(
        { ...answer, deskTake: "According to Source 99, construction slowed." },
        [source(12)],
        3
      )
    ).toThrow();
    expect(() =>
      validateAnswerRefs({ ...answer, sourceRefs: [12, 13] }, [source(12), source(13)], 1)
    ).toThrow();
  });
});
