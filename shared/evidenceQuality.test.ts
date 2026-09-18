import { describe, expect, it } from "vitest";
import { evidenceEligible, evidenceText } from "./evidenceQuality";

const title = "Sydney housing supply tightens";
const item = { title, source: "Publisher", sourceUrl: "https://publisher.test/report" };
describe("evidence source hygiene", () => {
  it.each([
    [
      "More than 1,000 homes coming after Caivan Perth development wins approval",
      "lanarkleedstoday.ca",
    ],
    [
      "Builder defends controversial Newcastle housing plans after row over council land deal",
      "Yahoo News UK",
    ],
    [
      "New Perth youth housing hub launched to help those at risk of homelessness",
      "dailyrecord.co.uk",
    ],
    ["Perth housing approvals rise", "Unresolved Publisher"],
    [
      "Sourcing Program Lead | Melbourne - CBD | Department of Families, Fairness and Housing Careers",
      "jobs.careers.vic.gov.au",
    ],
  ])(
    "holds unsuitable or unlocated references despite Australian search text: %s",
    (title, source) => {
      const input = {
        title,
        source,
        sourceUrl: "https://news.google.com/rss/articles/fixture",
        summary: "Sydney and Western Australia housing markets Publisher",
      };
      expect(evidenceEligible(input, "2026-09-18")).toBe(false);
      expect(evidenceText(input).summary).toBe("");
    }
  );
  it("requires a usable Australian anchor for ambiguous names and retains genuine reporting", () => {
    for (const input of [
      {
        title: "Perth housing supply tightens",
        source: "PerthNow",
        sourceUrl: "https://news.google.com/rss/articles/fixture",
      },
      {
        title: "Newcastle housing supply tightens",
        source: "Newcastle Herald",
        sourceUrl: "https://news.google.com/rss/articles/fixture",
      },
      {
        title: "Perth WA housing supply tightens",
        source: "Publisher",
        sourceUrl: "https://news.google.com/rss/articles/fixture",
      },
      {
        title: "Perth housing supply tightens",
        source: "Publisher",
        sourceUrl: "https://publisher.test/report",
        summary: "Western Australia faces rental shortages.",
      },
      {
        title: "Newcastle housing supply tightens",
        source: "Publisher",
        sourceUrl: "https://publisher.com.au/report",
      },
      {
        title: "Sydney social housing grants: apply now",
        source: "NSW Government",
        sourceUrl: "https://www.nsw.gov.au/housing",
      },
      {
        title: "Housing construction job vacancies fall",
        source: "ABS",
        sourceUrl: "https://www.abs.gov.au/jobs",
      },
    ])
      expect(evidenceEligible(input, "2026-09-18")).toBe(true);
    expect(
      evidenceEligible(
        {
          title: "Perth housing supply tightens",
          source: "BBC",
          sourceUrl: "https://www.bbc.co.uk/news/housing",
          summary: "Western Australia faces rental shortages.",
        },
        "2026-09-18"
      )
    ).toBe(true);
    expect(
      evidenceEligible(
        {
          title: "Perth housing supply tightens",
          summary: "Perth, Ontario approved the project.",
          sourceUrl: "https://publisher.com.au/report",
        },
        "2026-09-18"
      )
    ).toBe(false);
  });
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
    expect(
      evidenceEligible({ ...item, title: 'Perth report <script>alert("x")</script>' }, "2026-09-14")
    ).toBe(false);
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
