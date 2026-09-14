import { describe, expect, it } from "vitest";
import { evidenceEligible, evidenceText } from "./evidenceQuality";

const title = "Sydney housing supply tightens";
const item = { title, source: "Publisher", sourceUrl: "https://publisher.test/report" };
describe("evidence source hygiene", () => {
  it("removes repeated headlines and publisher-only tails without inventing prose", () => {
    expect(evidenceText({ ...item, summary: `${title} ${title} Publisher` }).summary).toBe("");
    expect(
      evidenceText({
        ...item,
        title: `${title} - Publisher`,
        summary: `${title} - Publisher ${title} Publisher`,
      })
    ).toEqual({ title, summary: "" });
    expect(
      evidenceText({ ...item, summary: `${title}. ${title}. New approvals fell in August.` })
        .summary
    ).toBe("New approvals fell in August.");
  });
  it("preserves meaningful prose, including a publisher named as the subject", () => {
    const summary = "Publisher reported that Sydney rental supply fell in August.";
    expect(evidenceText({ ...item, summary }).summary).toBe(summary);
  });
  it("never presents Google search roundups as article excerpts or inferred geography", () => {
    const source = {
      ...item,
      summary: `${title} Publisher Perth rents rise Another newspaper`,
      sourceUrl: "https://news.google.com/rss/articles/abc",
    };
    expect(evidenceText(source)).toEqual({ title, summary: "" });
    expect(source.summary).toContain("Perth"); // The raw record remains intact.
    expect(evidenceEligible(source, "2026-09-14")).toBe(true);
  });
  it("drops extraction debris but retains a usable headline", () => {
    for (const summary of [
      "@font-face { font-family: x }",
      "Subscribe to continue reading",
      "x".repeat(21000),
    ])
      expect(evidenceText({ ...item, summary }).summary).toBe("");
  });
  it("holds commercial event calls, not genuine housing news mentioning hotels or awards", () => {
    for (const title of [
      "Australian Mortgage Awards 2026: Book your hotel room now",
      "Property conference: Secure your tickets now",
      "Housing summit: Register now",
      "Sponsored content: Sydney property investment opportunities",
    ])
      expect(evidenceEligible({ ...item, title }, "2026-09-14")).toBe(false);
    for (const title of [
      "Sydney hotel conversion will deliver 120 affordable homes",
      "Award-winning Sydney housing project secures council approval",
      "Housing summit calls for more social housing",
      "Sydney hotel room bookings fall as housing costs rise",
    ])
      expect(evidenceEligible({ ...item, title }, "2026-09-14")).toBe(true);
  });
});
