import { describe, expect, it } from "vitest";
import { checkClaimEvidence, checkedContext } from "./claimEvidence";
import { assessStory } from "./editorial";
const source = {
  title: "NSW announces new social homes",
  articleText:
    "NSW plans to deliver 226 new social homes in Sydney. Funding of $1.5 billion was announced in September 2026. Rent growth was 4.3 per cent.",
};
describe("source claim checks", () => {
  it("keeps percentage points, percent changes and negative figures distinct", () => {
    const rate = {
      title: "Cash rate decision",
      articleText: "The cash rate changed by 25 basis points. Annual housing growth was -5%.",
    };
    expect(checkClaimEvidence("A change of 0.25 percentage points.", rate)).toEqual([]);
    expect(checkClaimEvidence("A change of 0.25%.", rate)).toContain("unsupported-figure");
    expect(checkClaimEvidence("Annual housing growth was 5%.", rate)).toContain(
      "unsupported-figure"
    );
    expect(checkClaimEvidence("Annual housing growth was -5%.", rate)).toEqual([]);
  });
  it("normalises money scales and percentages without inventing new values", () => {
    expect(checkClaimEvidence("NSW announced $1,500 million in September 2026.", source)).toEqual(
      []
    );
    expect(checkClaimEvidence("Rent growth was 4.3%.", source)).toEqual([]);
    expect(checkClaimEvidence("Funding of $226 million was announced.", source)).toContain(
      "unsupported-figure"
    );
    expect(checkClaimEvidence("Rent growth was 43%.", source)).toContain("unsupported-figure");
  });
  it("does not turn planned housing into completed supply", () => {
    expect(checkClaimEvidence("NSW delivered 226 new social homes.", source)).toContain(
      "delivery-status"
    );
    expect(checkClaimEvidence("NSW plans to deliver 226 homes.", source)).toEqual([]);
    expect(
      checkClaimEvidence("NSW delivered 226 new social homes.", {
        ...source,
        articleText: "NSW delivered 226 new social homes in Sydney.",
      })
    ).toEqual([]);
  });
  it("keeps forecasts and allegations qualified", () => {
    const forecast = {
      title: "Housing model released",
      articleText: "The model forecasts rents will rise 5%.",
    };
    expect(checkClaimEvidence("Rents rose 5%.", forecast)).toContain("forecast-as-fact");
    expect(checkClaimEvidence("The model forecasts rents will rise 5%.", forecast)).toEqual([]);
    const fraud = {
      title: "Bank inquiry",
      articleText: "Police allege $600 million in fraudulent loans.",
    };
    expect(
      checkClaimEvidence("The bank issued $600 million in fraudulent loans.", fraud)
    ).toContain("allegation-as-fact");
    expect(checkClaimEvidence("Police allege $600 million in fraudulent loans.", fraud)).toEqual(
      []
    );
  });
  it("holds unsupported places and months and does not let one angle verify another", () => {
    expect(checkClaimEvidence("Melbourne received the funding in June.", source)).toEqual(
      expect.arrayContaining(["unsupported-place", "unsupported-date"])
    );
    const result = checkedContext(
      {
        sayThis: "Sydney rents rose 7%.",
        whyItMatters: "That 7% changes affordability.",
        counterpoint: null,
      },
      source
    );
    expect(result.values).toEqual({ sayThis: null, whyItMatters: null, counterpoint: null });
    expect(Object.keys(result.held)).toEqual(["sayThis", "whyItMatters"]);
  });
  it("keeps conditional non-factual guidance and reports no evidence honestly", () => {
    expect(checkClaimEvidence("This may affect your borrowing budget.", source)).toEqual([]);
    expect(checkClaimEvidence("Read the original release.", { title: "New release" })).toEqual([
      "missing-evidence",
    ]);
  });
});

it("preserves the multiple causes of repayment changes and holds invented delivery timing", () => {
  const source = {
    title: "WA affordability",
    articleText:
      "Three rate rises combined with a higher average loan size added over $1,000 to monthly repayments.",
  };
  expect(
    checkClaimEvidence("Three rate rises added over $1,000 to monthly repayments.", source)
  ).toContain("figure-scope");
  expect(checkClaimEvidence(source.articleText, source)).toEqual([]);
  expect(
    checkClaimEvidence("These 710 lots are years from settlement.", {
      title: "710 new lots",
      summary: "Infrastructure funding will enable 710 lots.",
    })
  ).toContain("period-scope");
});

it("does not let a definitive headline or consultation date turn draft height limits into law", () => {
  const source = {
    title: "Harbour Ward height limits raised",
    articleText:
      "Proposed amendments would raise Harbour Ward height limits from 12 to 20 storeys. Consultation closes in October. Valley Ward's height limit was raised last year.",
  };
  expect(
    checkClaimEvidence(
      "Harbour Ward just had its height limit lifted from 12 to 20 storeys, and consultation closes in October.",
      source
    )
  ).toContain("proposal-as-fact");
  expect(checkClaimEvidence("Harbour Ward's height limit has been raised.", source)).toContain(
    "proposal-as-fact"
  );
  expect(
    checkClaimEvidence("The proposed height limit would rise from 12 to 20 storeys.", source)
  ).toEqual([]);
  expect(checkClaimEvidence("Valley Ward's height limit was raised last year.", source)).toEqual(
    []
  );
  expect(checkClaimEvidence("The height limit has not yet been raised.", source)).toEqual([]);
});

it.each([
  ["Annual wages grew 0.8%.", "Quarterly wages grew 0.8%. Annual wages grew 3.2%.", "period-scope"],
  ["NSW rents grew 3%.", "NSW rents grew 5%. Queensland rents grew 3%.", "figure-scope"],
  ["Unemployment was 5%.", "Unemployment was 4%. Rents grew 5%.", "figure-scope"],
  [
    "Seasonally adjusted unemployment was 4.3%.",
    "Trend unemployment was 4.3%. Seasonally adjusted unemployment was 4.5%.",
    "series-basis",
  ],
  [
    "Annual house prices rose 5%.",
    "Annual rents rose 5%. Monthly house prices rose 5%.",
    "period-scope",
  ],
])("binds a known figure to its actual meaning: %s", (copy, articleText, issue) => {
  expect(checkClaimEvidence(copy, { title: copy, articleText })).toContain(issue);
  expect(checkedContext({ sayThis: copy }, { title: copy, articleText }).values.sayThis).toBeNull();
});
it.each(["Quarterly wages grew 0.8%.", "Annual wages grew 3.2%."])(
  "preserves valid original figure scope: %s",
  (copy) => {
    expect(
      checkClaimEvidence(copy, {
        title: "Wage data",
        articleText: "Quarterly wages grew 0.8%. Annual wages grew 3.2%.",
      })
    ).toEqual([]);
  }
);
it("holds a contradictory headline before routine publication, with an auditable reason", () => {
  const input = {
    title: "NSW annual rent growth hits 0.8%",
    sourceUrl: "https://www.abs.gov.au/housing-release",
    channel: "PROPERTY",
    category: "PROPERTY",
    sourceTiming: {
      feedReportedAt: "2026-09-17T01:00:00Z",
      publisherDateStatus: "available" as const,
      publisherPublishedAt: "2026-09-17T01:00:00Z",
      retrievedAt: "2026-09-17T02:00:00Z",
    },
    articleText:
      "NSW quarterly rent growth was 0.8%. NSW annual rent growth was 3.2%. " +
      "The release reports observed rental conditions for residential housing and does not provide a forecast of future prices. ".repeat(
        4
      ),
  };
  expect(assessStory(input, new Date("2026-09-17T03:00:00Z"))).toMatchObject({
    eligible: false,
    reason: "headline-evidence:period-scope",
  });
  expect(
    assessStory(
      { ...input, title: "NSW annual rent growth hits 3.2%" },
      new Date("2026-09-17T03:00:00Z")
    )
  ).toMatchObject({ eligible: true });
});
it("holds a rezoned headline when the body describes only a proposal", () => {
  expect(
    checkClaimEvidence("Feasibility concerns have not disappeared with rezoning.", {
      title: "",
      articleText: "Proposed planning changes would allow 200 homes in Harbour Ward.",
    })
  ).toContain("proposal-as-fact");
  expect(
    checkClaimEvidence("Harbour Ward rezoned for 200 homes", {
      title: "",
      articleText: "Proposed planning changes would allow 200 homes in Harbour Ward.",
    })
  ).toContain("proposal-as-fact");
  expect(
    checkClaimEvidence("Harbour Ward to be rezoned for 200 homes", {
      title: "",
      articleText: "Proposed planning changes would allow 200 homes in Harbour Ward.",
    })
  ).not.toContain("proposal-as-fact");
});
