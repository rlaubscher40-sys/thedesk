import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RelatedCoverage } from "./RelatedCoverage";
import { Router } from "wouter";
it("keeps related story and publisher links accessible inside native disclosure controls", () => {
  const lead = {
    id: 1,
    title: "Housing delivery",
    source: "NSW",
    sourceUrl: "https://www.nsw.gov.au/release",
  };
  const related = { ...lead, id: 2, title: "Delivery update" };
  const html = renderToStaticMarkup(
    createElement(
      Router,
      { ssrPath: "/" },
      createElement(RelatedCoverage, { groups: [{ lead, related: [related] }] })
    )
  );
  expect(html).toContain("<details");
  expect(html).toContain('href="/story/2"');
  expect(html).toContain("Delivery update");
  expect(html).toContain('href="https://www.nsw.gov.au/release"');
  expect(html).not.toContain("confirmed");
});
