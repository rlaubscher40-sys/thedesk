import { describe, expect, it } from "vitest";
import { checkClaimEvidence, checkedContext } from "./claimEvidence";
import { assessStory } from "./editorial";
const source = {
  title: "NSW announces new social homes",
  articleText:
    "NSW plans to deliver 226 new social homes in Sydney. Funding of $1.5 billion was announced in September 2026. Rent growth was 4.3 per cent.",
};
describe("source claim checks", () => {
  it("does not infer losing sellers' behaviour from profitable sellers' holding periods", () => {
    const source = {
      title: "Resale profits",
      articleText:
        "Profitable resales were held for a median 9.1 years, compared with 8.1 years for loss-making sales.",
    };
    const bad =
      "Profitable resales were held a median 9.1 years, which means most of the loss-making sales reflect short holds, not broad market destruction.";
    expect(checkClaimEvidence(bad, source)).toContain("cohort-scope");
    expect(checkedContext({ counterpoint: bad }, source).values.counterpoint).toBeNull();
    expect(checkClaimEvidence(source.articleText, source)).toEqual([]);
    expect(
      checkClaimEvidence(
        "The median for profitable resales does not mean most loss-making sales reflect short holds.",
        source
      )
    ).not.toContain("cohort-scope");
    expect(
      checkClaimEvidence(bad, {
        ...source,
        articleText: source.articleText + " Most loss-making resales were short holds.",
      })
    ).not.toContain("cohort-scope");
  });
  it("keeps the planning commission's advice separate from the minister's decision", () => {
    const source = {
      title: "Town Hall Square",
      articleText:
        "The minister requested advice from the Independent Planning Commission (IPC). The minister's decision will follow the advice.",
    };
    expect(
      checkClaimEvidence("The IPC now decides whether it becomes a state matter.", source)
    ).toContain("decision-authority");
    expect(
      checkClaimEvidence("The minister will decide after receiving IPC advice.", source)
    ).toEqual([]);
    expect(
      checkClaimEvidence("The IPC does not decide whether it becomes a state matter.", source)
    ).not.toContain("decision-authority");
  });
  it("retains the inflation condition on easing and does not invent reform prerequisites", () => {
    const source = {
      title: "IMF rate guidance",
      articleText:
        "If growth slows sharply, rate cuts should be considered, but only if inflation looks to be coming under control, the IMF said. Structural reform could improve productivity.",
    };
    expect(
      checkClaimEvidence(
        "The IMF also said rate cuts should be considered if growth slows sharply.",
        source
      )
    ).toContain("conditional-guidance");
    expect(
      checkClaimEvidence(
        "Rate relief depends on structural reform, not just monthly CPI readings.",
        source
      )
    ).toContain("conditional-guidance");
    expect(
      checkClaimEvidence(
        "The IMF says rate cuts should be considered if growth slows sharply and inflation is coming under control.",
        source
      )
    ).toEqual([]);
    expect(
      checkClaimEvidence("Rate relief does not depend on structural reform alone.", source)
    ).not.toContain("conditional-guidance");
    expect(
      checkClaimEvidence("Rate cuts should be considered if growth slows.", {
        title: "A different forecast",
        articleText: "Rate cuts should be considered if growth slows.",
      })
    ).toEqual([]);
  });
  it("does not turn an introduced repeal bill into a removed housing obligation", () => {
    const proposed = {
      title: "Pathway forward for Glenden",
      articleText:
        "Queensland introduced legislation that will repeal worker-accommodation obligations for the Byerwen mine.",
    };
    for (const copy of [
      "Queensland just stripped a coal mine's obligation to house workers.",
      "Removing QCoal's obligation reduces local economic activity.",
      "The housing obligation has been repealed.",
    ])
      expect(checkClaimEvidence(copy, proposed)).toContain("proposal-as-fact");
    for (const copy of [
      "Queensland introduced a bill to remove worker-accommodation obligations.",
      "The obligation has not yet been removed.",
      "The proposed repeal would remove the housing obligation.",
    ])
      expect(checkClaimEvidence(copy, proposed)).not.toContain("proposal-as-fact");
    expect(
      checkClaimEvidence("The housing obligation has been repealed.", {
        ...proposed,
        articleText:
          proposed.articleText + " The legislation to repeal the obligation received royal assent.",
      })
    ).not.toContain("proposal-as-fact");
  });
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
