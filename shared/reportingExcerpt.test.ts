import { expect, it } from "vitest";
import { reportingExcerpt, cleanReportingExcerpt } from "./reportingExcerpt";
import { evidenceEligible } from "./evidenceQuality";
it("does not repeat a finding from a release's summary bullet", () => {
  const first =
    "The six-month annualised growth rate in the Westpac-Melbourne Institute Leading Index, which indicates the likely pace of economic activity relative to trend three to nine months into the future, lifted to -0.09% in August from -0.17% in July.";
  const repeat = "Leading Index growth rate lifts to -0.09% in August from -0.17% in July.";
  expect(
    reportingExcerpt("Leading Index suggests momentum a touch below trend", first + "\n\n" + repeat)
  ).toBe(first);
});
it("keeps a changed figure and a negative qualification", () => {
  const first =
    "The national rental index increased by 3.5 percent in July across the surveyed homes.";
  const change =
    "The national rental index increased by 3.6 percent in August across the surveyed homes.";
  expect(reportingExcerpt("National rental index", first + "\n\n" + change)).toContain(change);
  const caution = "The national rental index has not increased across all surveyed homes.";
  expect(reportingExcerpt("National rental index", first + "\n\n" + caution)).toContain(caution);
});
it("rejects unattributed quotes and context-dependent fragments", () => {
  const quote =
    '"The immigration policy is a recipe to destroy the Australian economy and drive it into recession," he said.';
  const context =
    "For people already living that reality, the question of immigration policy isn't abstract.";
  const finding =
    "The party's immigration policy proposes changes to temporary visas and migration settings.";
  expect(reportingExcerpt("Immigration policy", quote + "\n\n" + context + "\n\n" + finding)).toBe(
    finding
  );
  expect(reportingExcerpt("Immigration policy", quote + "\n\n" + context)).toBe("");
});
it("skips a minister's title and selects the funding announcement", () => {
  const text =
    "Deputy Premier, Minister for State Development, Infrastructure and Planning and Minister for Industrial Relations The Honourable Jarrod Bleijie\n\nThe government has announced infrastructure funding to enable 710 new homes across South Burnett and Somerset.";
  expect(
    reportingExcerpt("710 new homes fast tracked across South Burnett and Somerset regions", text)
  ).toContain("funding to enable 710");
});
it("does not mistake an opening analogy for the finding", () => {
  const text =
    "Bloodletting is an ancient therapy, dating back at least three millennia, and traditionally used to cure a range of ills.\n\nThe RBA faces inflation driven by supply constraints which higher interest rates cannot directly resolve.";
  expect(reportingExcerpt("RBA inflation and higher interest rates", text)).toMatch(/^The RBA/);
});
it("declines irrelevant or fragment-only text and marks clipped words", () => {
  expect(
    reportingExcerpt(
      "Sydney rents",
      "The Honourable Minister for State Development and Infrastructure, Planning and Industrial Relations"
    )
  ).toBe("");
  const result = reportingExcerpt(
    "Sydney rents",
    "Sydney rents have risen as rental housing availability has tightened substantially across many parts of the city.",
    75
  );
  expect(result).toMatch(/ …$|\w…$/);
  expect(result.length).toBeLessThanOrEqual(75);
});
it("removes syndication chrome and excludes irrelevant discovery matches", () => {
  expect(
    cleanReportingExcerpt("Sydney rents rose. The post Sydney rents appeared first on Broker News.")
  ).toBe("Sydney rents rose.");
  expect(
    evidenceEligible(
      { title: "Made for $1500, this Australian film takes a swipe at greedy landlords" },
      "2026-09-16"
    )
  ).toBe(false);
  expect(
    evidenceEligible(
      {
        title:
          "West Coast Valuers Highlights the Role of Independent Valuations as Perth Property Market Conditions Shift",
      },
      "2026-09-16"
    )
  ).toBe(false);
  expect(
    evidenceEligible(
      { title: "Perth housing approvals rise as new apartments enter the pipeline", source: "ABS" },
      "2026-09-16"
    )
  ).toBe(true);
});

it("preserves decimal figures within reporting sentences", () => {
  expect(
    reportingExcerpt(
      "Rent inflation eases",
      "Annual rent inflation eased to 3.5 percent from 3.8 percent in the previous release."
    )
  ).toContain("3.5 percent from 3.8 percent");
});

it("prefers a relevant opening finding over a keyword-rich historical aside", () => {
  const lead =
    "Australia's migration intake fell over the year, according to new national figures released today.";
  const background =
    "It comes as analysis of older migration data showed areas with lower migration intake had slower home price and rent growth.";
  expect(
    reportingExcerpt("Latest migration figures and home prices, rents", lead + "\n\n" + background)
  ).toBe(lead);
});
it("does not publish a standalone first-person statement without attribution", () => {
  expect(
    reportingExcerpt(
      "Town Hall Square",
      "I have issued a direction preventing determination of development applications for the Town Hall Square proposal."
    )
  ).toBe("");
});
