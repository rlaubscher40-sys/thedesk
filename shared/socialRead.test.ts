import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeaturedComparisonRead } from "./FeaturedComparisonRead";
import { CityRentRead } from "./CityRentRead";
import { PUBLIC_MARKETS, type MarketDirectory } from "./marketDirectory";

describe("social evidence destinations", () => {
  it("retains archived evidence routes rather than negative story IDs", () => {
    const directory: MarketDirectory = {
      asOf: "2026-09-09",
      since: "2026-06-09",
      sampleLimit: 100,
      sampleCapped: false,
      demo: false,
      markets: PUBLIC_MARKETS.filter((m) => m.slug === "perth").map((market) => ({
        market,
        asOf: "2026-09-09",
        since: "2026-06-09",
        referenceCount: 1,
        publisherCount: 1,
        latestMention: "2026-09-09",
        coverage: "limited",
        indexable: false,
        references: [
          {
            id: -619,
            href: "/evidence/619",
            title: "Perth housing approvals",
            excerpt: "Perth approvals",
            date: "2026-09-09",
            publisher: "ABS",
            sourceUrl: "https://www.abs.gov.au",
            category: "PROPERTY",
          },
        ],
      })),
    };
    const html = renderToStaticMarkup(createElement(FeaturedComparisonRead, { directory }));
    expect(html).toContain('href="/evidence/619"');
    expect(html).not.toContain("/story/-619");
  });
  it("makes the previous annual rate inspectable without claiming a monthly rent change", () => {
    const html = renderToStaticMarkup(
      createElement(CityRentRead, {
        marketA: "Sydney",
        asOf: "2026-09-09",
        data: {
          status: "available",
          retrievedAt: "2026-09-09T00:00:00Z",
          observations: [
            { city: "Sydney", period: "2026-07", annualPercent: 3.5, status: "" },
            { city: "Sydney", period: "2026-06", annualPercent: 3.8, status: "r" },
          ],
        },
      })
    );
    expect(html).toContain('id="rental-conditions"');
    expect(html).toContain("3.8%");
    expect(html.replace(/<[^>]*>/g, "")).toContain("3.5%");
    expect(html).toContain("not the latest month");
  });
});
