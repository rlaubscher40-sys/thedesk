import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewLoanRatesRead } from "./NewLoanRatesRead";
import { testLoanRates } from "../server/instagram/fixtures/contextReels";
it("shows exact Reel rates, the reference month, meaning and primary source links", () => {
  const html = renderToStaticMarkup(createElement(NewLoanRatesRead, { rates: testLoanRates() }));
  for (const text of [
    "6.2%",
    "6.4%",
    "July 2026",
    "not personal offers",
    "not a like-for-like",
    "f6-data.csv",
    "moneysmart.gov.au",
    'id="new-loan-rates"',
    "hypothetical $500,000",
    "$2,998",
    "$3,222",
    "Total interest",
    "before rounding",
    "mortgage-calculator",
  ])
    expect(html).toContain(text);
  const missing = renderToStaticMarkup(createElement(NewLoanRatesRead, { rates: [] }));
  expect(missing).toContain("unavailable");
  expect(missing).not.toContain("6.24");
});
