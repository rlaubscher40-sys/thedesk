import { expect, it } from "vitest";
import { correctReviewedEditionText } from "./reviewedEditionCorrection";
it("qualifies only exact reviewed language across nested edition fields", () => {
  const original = {
    topics: [
      {
        whyItMatters:
          "Another hike directly cuts the maximum loan a buyer can be approved for and lifts repayments on everyone already holding debt, right as spring listings arrive.",
        sourceItemIds: [123],
        summary: "An editor's subsequent wording.",
      },
    ],
  };
  const corrected = correctReviewedEditionText(original);
  expect(corrected.topics[0]!.whyItMatters).toContain("fixed-rate repayments");
  expect(corrected.topics[0]!.sourceItemIds).toEqual([123]);
  expect(corrected.topics[0]!.summary).toBe(original.topics[0]!.summary);
  expect(original.topics[0]!.whyItMatters).toContain("everyone");
  expect(correctReviewedEditionText(corrected)).toEqual(corrected);
});
