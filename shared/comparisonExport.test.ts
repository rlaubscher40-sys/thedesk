import { expect, it } from "vitest";
import { comparisonResearchText } from "./comparisonExport";
import {
  comparisonAnswer,
  comparisonEvidence,
  comparisonNow,
} from "../server/markets/comparison.fixture";
import { groundComparison } from "../server/markets/grounding";
it("retains dated source evidence, compatibility gaps and signed destination in the portable export", () => {
  const view = groundComparison(
    comparisonAnswer,
    comparisonEvidence,
    "Brisbane",
    "Perth",
    comparisonNow
  )!;
  view.rows[0]!.marketA!.basis = undefined;
  const text = comparisonResearchText(view, "example-token");
  expect(text).toContain("Not directly comparable");
  expect(text).toContain("Observation period: not established");
  expect(text).toContain(view.rows[0]!.marketA!.quote);
  expect(text).toContain(view.sources[0]!.href);
  expect(text).toContain("/brief?t=example-token");
  expect(text).toContain("not measured price movements");
  expect(text).toContain("does not update itself");
  expect(text).not.toContain("[object Object]");
});
