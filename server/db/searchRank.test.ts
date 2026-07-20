import { describe, expect, it } from "vitest";
import { extractSnippet, rankResults, scoreMatch } from "./searchRank";

describe("scoreMatch", () => {
  it("ranks a title hit above a body-only hit", () => {
    const titleHit = scoreMatch("rates", "RBA holds rates", "unrelated body");
    const bodyHit = scoreMatch("rates", "Housing update", "the rates were held");
    expect(titleHit).toBeGreaterThan(bodyHit);
  });

  it("rewards a title that starts with the query", () => {
    const prefix = scoreMatch("rba", "RBA decision", "");
    const mid = scoreMatch("rba", "The RBA decision", "");
    expect(prefix).toBeGreaterThan(mid);
  });

  it("scores an empty query as zero", () => {
    expect(scoreMatch("", "anything", "anything")).toBe(0);
  });
});

describe("extractSnippet", () => {
  it("centres the snippet on the match with ellipses", () => {
    const body = "a".repeat(200) + " NEEDLE " + "b".repeat(200);
    const snip = extractSnippet("needle", body, 20);
    expect(snip).toContain("NEEDLE");
    expect(snip?.startsWith("…")).toBe(true);
    expect(snip?.endsWith("…")).toBe(true);
  });

  it("returns null when the query isn't in the body", () => {
    expect(extractSnippet("missing", "some other text")).toBeNull();
  });

  it("omits the leading ellipsis when the match is at the start", () => {
    const snip = extractSnippet("start", "start of the body text here", 50);
    expect(snip?.startsWith("…")).toBe(false);
  });
});

describe("rankResults", () => {
  const rows = [
    { id: 1, title: "Housing supply", body: "mentions rates once" },
    { id: 2, title: "Rates decision", body: "the RBA held" },
    { id: 3, title: "Unrelated", body: "no hit here" },
  ];

  it("orders title matches before body-only matches and attaches snippets", () => {
    const ranked = rankResults(
      "rates",
      rows,
      (r) => r.title,
      (r) => r.body
    );
    expect(ranked[0]!.id).toBe(2); // title hit
    expect(ranked[1]!.id).toBe(1); // body-only hit
    expect(ranked[1]!.snippet).toContain("rates");
  });

  it("is a stable sort within the same score (preserves DB order)", () => {
    const tied = [
      { id: 10, title: "Rates A", body: "" },
      { id: 11, title: "Rates B", body: "" },
    ];
    const ranked = rankResults(
      "rates",
      tied,
      (r) => r.title,
      (r) => r.body
    );
    expect(ranked.map((r) => r.id)).toEqual([10, 11]);
  });
});
