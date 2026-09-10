import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/trpc", () => ({ trpc: {} }));
import { CoverageResults } from "./CoverageReview";
import { evaluateCoverage } from "@shared/editorialCoverage";
import { coverageExamples } from "@shared/editorialCoverageExamples";
it("labels the starting examples as provisional without presenting a fabricated coverage score", () => {
  const review = evaluateCoverage(coverageExamples("2026-09-10"), "2026-09-10", [], []);
  const html = renderToStaticMarkup(createElement(CoverageResults, { review }));
  expect(html).toContain("No editor-reviewed benchmark yet");
  expect(html).toContain("Provisional");
  expect(html).toContain("No matching saved record");
  expect(html).not.toContain("100%");
  expect(html).toContain("do not measure factual accuracy");
});
it("shows reviewed outcomes and source failures without blaming every missing event on that failure", () => {
  const review = evaluateCoverage(
    coverageExamples("2026-09-10").map((e) => ({ ...e, reviewed: true })),
    "2026-09-10",
    [],
    []
  );
  review.failedSources = ["Example source"];
  const html = renderToStaticMarkup(createElement(CoverageResults, { review }));
  expect(html).toContain("0 of 3 reviewed events have confirmed local coverage");
  expect(html).toContain("A failed source alone does not establish that an event was missed");
});
