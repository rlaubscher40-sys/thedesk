import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CityRentRead } from "./CityRentRead";
import type { CityRents } from "./cityRents";
const data: CityRents = {
  status: "available",
  retrievedAt: "2026-09-07T00:00:00Z",
  observations: [
    { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "" },
    { city: "Brisbane", period: "2026-07", annualPercent: 4.6, status: "r" },
  ],
};
describe("official rental read", () => {
  it("pins an earlier month even when a newer observation is present", () => {
    const html = renderToStaticMarkup(createElement(CityRentRead, {
      data: {...data, observations:[...data.observations, {city:"Perth", period:"2026-06", annualPercent:5.5, status:""}]},
      marketA:"Perth", asOf:"2026-09-10", period:"2026-06",
    }));
    expect(html).toContain("5.5");
    expect(html).toContain("Year to June 2026");
    expect(html).toContain("Historical observation");
    expect(html).not.toContain("5.3");
    expect(html).not.toContain("Latest available in the retrieved series");
  });
  it.each(["2025-06", "2026-13", "", "bad-date"])("never substitutes latest for missing or invalid period %s", period => {
    const html = renderToStaticMarkup(createElement(CityRentRead, {data,marketA:"Perth",asOf:"2026-09-10",period}));
    expect(html).not.toContain("tracking-tight");
    expect(html).toContain("not been substituted");
  });
  it("states only a same-period gap, the definition and separation from a saved brief", () => {
    const html = renderToStaticMarkup(
      createElement(CityRentRead, {
        data,
        marketA: "Perth",
        marketB: "Brisbane",
        asOf: "2026-09-07",
      })
    );
    expect(html).toContain("0.7 percentage points higher");
    expect(html).toContain("does not establish the stronger investment setup");
    expect(html).toContain("separate from the dated intelligence brief");
    expect(html).toContain('href="/markets?q=Perth&amp;rentPeriod=2026-07#rental-conditions"');
    expect(html).toContain("Revised");
  });
  it("shows unsupported geography and withholds a false gap", () => {
    const html = renderToStaticMarkup(
      createElement(CityRentRead, {
        data,
        marketA: "Perth",
        marketB: "Townsville",
        asOf: "2026-09-07",
      })
    );
    expect(html).toContain("No regional or suburb estimate is substituted");
    expect(html).toContain("No current same-period rent gap");
    expect(html).not.toContain("percentage points higher");
  });
  it("labels unavailable and older observations explicitly", () => {
    const unavailable = renderToStaticMarkup(
      createElement(CityRentRead, { marketA: "Perth", asOf: "2026-09-07" })
    );
    expect(unavailable).toContain("temporarily unavailable");
    expect(unavailable).not.toContain("tracking-tight");
    const older = renderToStaticMarkup(
      createElement(CityRentRead, {
        data,
        marketA: "Perth",
        marketB: "Brisbane",
        asOf: "2026-11-01",
      })
    );
    expect(older).toContain("Older observation");
    expect(older).not.toContain("percentage points higher");
  });
});
