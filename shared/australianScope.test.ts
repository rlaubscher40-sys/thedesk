import { expect, it } from "vitest";
import { evidenceEligible } from "./evidenceQuality";
import { foreignHousingHeadline } from "./australianScope";
const day = "2026-09-18";
const title =
  "Builder defends controversial Newcastle housing plans after row over council land deal";
it("rejects the audited UK namesake through an aggregator and direct sources", () => {
  expect(
    evidenceEligible(
      { title, source: "Yahoo News UK", sourceUrl: "https://news.google.com/rss/articles/fixture" },
      day
    )
  ).toBe(false);
  for (const [place, source, sourceUrl] of [
    ["Newcastle", "ChronicleLive", "https://www.chroniclelive.co.uk/news/housing"],
    ["Perth", "CBC News", "https://news.google.com/rss/articles/fixture"],
    ["Newcastle", "Publisher", "https://example.co.za/housing"],
  ])
    expect(foreignHousingHeadline(`${place} housing plans`, sourceUrl, source)).toBe(true);
});
it("holds an unresolved namesake, ignoring Google roundup geography", () => {
  expect(
    evidenceEligible(
      {
        title,
        summary: "Sydney NSW homes rise Another newspaper",
        source: "Unresolved publisher",
        sourceUrl: "https://news.google.com/rss/articles/fixture",
      },
      day
    )
  ).toBe(false);
  expect(
    evidenceEligible(
      {
        title: "Perth housing plan",
        source: "Unresolved publisher",
        sourceUrl: "https://example.com/story",
      },
      day
    )
  ).toBe(false);
});
it("retains explicit Australian reporting including overseas publishers covering Australia", () => {
  for (const row of [
    {
      title,
      source: "Newcastle Herald",
      sourceUrl: "https://news.google.com/rss/articles/fixture",
    },
    {
      title: "Newcastle NSW housing plans",
      source: "BBC",
      sourceUrl: "https://www.bbc.co.uk/news/story",
    },
    {
      title: "Perth housing approvals",
      source: "Publisher",
      sourceUrl: "https://publisher.com.au/story",
    },
    {
      title,
      summary: "The housing development is in Newcastle, New South Wales.",
      source: "Publisher",
      sourceUrl: "https://publisher.com/story",
    },
  ])
    expect(evidenceEligible(row, day)).toBe(true);
});
