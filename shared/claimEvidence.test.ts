import { describe, expect, it } from "vitest";
import { checkClaimEvidence, checkedContext } from "./claimEvidence";
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
