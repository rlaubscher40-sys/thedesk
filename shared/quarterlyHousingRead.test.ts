import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransferRead, CompletionRead } from "./QuarterlyHousingRead";
import {
  housingPeriod,
  transferForMarket,
  type HousingTransfers,
  type HousingCompletions,
} from "./quarterlyHousing";
const transfers: HousingTransfers = {
  status: "available",
  period: "2026-Q2",
  retrievedAt: "2026-09-17",
  sourceUrl: "https://www.abs.gov.au/source",
  resourceUrl: null,
  observations: [
    {
      area: "Brisbane",
      period: "2026-Q2",
      houseMedian: 1155000,
      attachedMedian: 830100,
      houseTransfers: 6559,
      attachedTransfers: 3509,
    },
    {
      area: "Brisbane",
      period: "2026-Q1",
      houseMedian: 1000000,
      attachedMedian: null,
      houseTransfers: 100,
      attachedTransfers: null,
    },
  ],
};
it("shows dated separate sales segments and source provenance", () => {
  const html = renderToStaticMarkup(
    createElement(TransferRead, { data: transfers, area: "Brisbane", asOf: "2026-09-17" })
  );
  expect(html).toContain("$1,155,000");
  expect(html).toContain("6,559");
  expect(html).toContain("not a price-growth index");
  expect(html).toContain("transferPeriod=2026-Q1");
  expect(html).toContain("Preliminary");
});
it("never substitutes latest or rest-of-state data for unavailable history or locality", () => {
  expect(transferForMarket("Townsville")).toBeUndefined();
  const html = renderToStaticMarkup(
    createElement(TransferRead, {
      data: transfers,
      area: "Brisbane",
      period: "2025-Q1",
      asOf: "2026-09-17",
    })
  );
  expect(html).toContain("No other period");
  expect(html).not.toContain("$1,155,000");
  expect(housingPeriod(transfers, "2027-04-01")).toBeNull();
  expect(housingPeriod(transfers, "2027-04-01", "2026-Q2")).toBe("2026-Q2");
  expect(housingPeriod(transfers, "2026-09-17", "2026-Q3")).toBeNull();
});
it("renders historical suppressed values as unavailable, not zero", () => {
  const html = renderToStaticMarkup(
    createElement(TransferRead, {
      data: transfers,
      area: "Brisbane",
      period: "2026-Q1",
      asOf: "2026-09-17",
    })
  );
  expect(html).toContain("$1,000,000");
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("$1,155,000");
});
it("labels whole-state original completions and four-quarter totals explicitly", () => {
  const data: HousingCompletions = {
    ...transfers,
    period: "2026-Q1",
    observations: [{ state: "QLD", period: "2026-Q1", quarter: 8035, year: 32000 }],
  };
  const html = renderToStaticMarkup(
    createElement(CompletionRead, { data, stateCode: "QLD", asOf: "2026-09-17" })
  );
  expect(html).toContain("8,035");
  expect(html).toContain("four quarters");
  expect(html).toContain("not seasonally adjusted");
  expect(html).toContain("not estimate city");
  expect(html).toContain("completionPeriod=2026-Q1");
});
