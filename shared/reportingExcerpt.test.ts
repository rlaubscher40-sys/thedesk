import { expect, it } from "vitest";
import { reportingExcerpt, cleanReportingExcerpt } from "./reportingExcerpt";
import { evidenceEligible } from "./evidenceQuality";
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
