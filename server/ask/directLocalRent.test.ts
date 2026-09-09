import { describe, expect, it } from "vitest";
import type { FactEvidence } from "../localData/read";
import { directLocalRentAnswer } from "./directLocalRent";

function fact(period = "2026-06-30", value: number | null = 850): FactEvidence {
  return {
    title: "4000 QLD",
    date: period,
    href: `/markets?period=${period}`,
    publisher: "RTA",
    sourceUrl: "https://source.test/rents.xlsx",
    text: "Stored rent evidence",
    localRent: {
      method: "New-tenancy medians, not asking rents. Bond counts are contextual.",
      observations: [
        {
          measure: "weekly-rent",
          value,
          unit: "AUD/week",
          period,
          category: "Flat 2",
          sample: 287,
          status: value === null ? "suppressed" : "published",
          periodLabel: `Quarter ended ${period}`,
          sampleLabel: "Bonds lodged",
        },
      ],
    },
  };
}

describe("direct factual local rent answers", () => {
  it("preserves both dated values, methodology and separate references", () => {
    const result = directLocalRentAnswer("Compare median weekly rents in June 2025 and June 2026", [
      fact(),
      fact("2025-06-30", 800),
    ]);
    expect(result).toMatchObject({ status: "answered", sourceRefs: [1, 2], signals: [] });
    expect(result!.answer).toContain("$850/week, Quarter ended 2026-06-30");
    expect(result!.answer).toContain("$800/week, Quarter ended 2025-06-30");
    expect(result!.answer).toContain("[Source 2]");
    expect(result!.answer).not.toContain("asking rents");
    expect(result!.whyItMatters).toBe(fact().localRent!.method);
  });
  it.each([
    "What is the median rent and why did it rise?",
    "What is the median rent and should I buy?",
    "What is the median rent and population outlook?",
  ])("leaves interpretation to the normal path: %s", (question) => {
    expect(directLocalRentAnswer(question, [fact()])).toBeNull();
  });
  it("does not combine incompatible or withheld observations", () => {
    const question = "Compare median weekly rents";
    expect(
      directLocalRentAnswer(question, [fact(), { ...fact(), sourceUrl: "https://other.test" }])
    ).toBeNull();
    expect(directLocalRentAnswer(question, [fact(), fact("2025-06-30", null)])).toBeNull();
  });
  it("does not silently truncate a larger selection", () => {
    expect(
      directLocalRentAnswer(
        "Show median weekly rents",
        Array.from({ length: 5 }, () => fact())
      )
    ).toBeNull();
  });
});
