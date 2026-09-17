// Uses static rendering so the normal .test.ts CI suite exercises the reader.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REGIONAL_CONTEXT, regionalContext } from "./regionalContext";
import { RegionalContextRead } from "./RegionalContextRead";
import { CouncilRentRead, type CouncilRents } from "./CouncilRentRead";
import { PublicMarketRead } from "./PublicMarketRead";
import { PUBLIC_MARKETS, type MarketDirectory, type PublicMarketFile } from "./marketDirectory";

const data = (): CouncilRents => ({
  area: {
    id: "QLD:LGA:townsville (c)",
    name: "Townsville (C)",
    state: "QLD",
    kind: "LGA",
    boundaryVersion: "RTA source geography",
    observations: [
      {
        measure: "weekly-rent",
        value: 550,
        unit: "AUD/week",
        period: "2026-06-30",
        category: "House 3",
        sample: 524,
        status: "published",
      },
      {
        measure: "weekly-rent",
        value: 500,
        unit: "AUD/week",
        period: "2025-06-30",
        category: "House 3",
        sample: 537,
        status: "published",
      },
      {
        measure: "weekly-rent",
        value: 999,
        unit: "AUD/week",
        period: "2026-06-30",
        category: "Flat 1",
        sample: 4,
        status: "suppressed",
      },
    ],
  },
  period: "2026-06-30",
  resourceUrl: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx",
  retrievedAt: "2026-09-09T07:50:48.995Z",
  older: false,
});
const renderRents = (input = data()) =>
  renderToStaticMarkup(createElement(CouncilRentRead, { data: input }));

describe("regional primary-source context", () => {
  it("keeps each market's sources separate and retains real dates and qualifiers", () => {
    expect(regionalContext("townsville", "2026-09-17")).toHaveLength(2);
    expect(regionalContext("newcastle", "2026-09-17")).toHaveLength(2);
    expect(regionalContext("sydney", "2026-09-17")).toEqual([]);
    for (const record of REGIONAL_CONTEXT) {
      expect(record.publishedOn <= record.reviewedOn).toBe(true);
      expect(new URL(record.sourceUrl).protocol).toBe("https:");
      expect(record.limitation.length).toBeGreaterThan(80);
    }
  });
  it.each(["bad", "2026-02-30", "2026-09-16"])(
    "does not expose unchecked context as of %s",
    (asOf) => {
      expect(regionalContext("townsville", asOf)).toEqual([]);
    }
  );
  it("flags overdue review without redating the original", () => {
    expect(regionalContext("townsville", "2026-10-16")[0]!.reviewDue).toBe(false);
    expect(regionalContext("townsville", "2026-10-17")[0]).toMatchObject({
      reviewDue: true,
      publishedOn: "2026-07-09",
      reviewedOn: "2026-09-17",
    });
    const html = renderToStaticMarkup(
      createElement(RegionalContextRead, { market: "townsville", asOf: "2026-10-17" })
    );
    expect(html).toContain("Review due");
    expect(html).toContain("First-party investor marketing");
    expect(html).toContain("not independent market analysis");
    expect(html).toContain("not a count of homes completed");
  });
  it("preserves proposal status and funding scope", () => {
    const html = renderToStaticMarkup(
      createElement(RegionalContextRead, { market: "newcastle", asOf: "2026-09-17" })
    );
    expect(html).toContain("not enacted controls");
    expect(html).toContain("not $3 million of home construction");
    expect(html).toContain("separate from the selected-reporting count");
  });
});
describe("council rental reader", () => {
  it("preserves observation periods, suppression, source counts and boundary", () => {
    const html = renderRents();
    expect(html).toContain("$550");
    expect(html).not.toContain("$500");
    expect(html).not.toContain("$999");
    expect(html).toContain("Not published");
    expect(html).toContain("524");
    expect(html).toContain("not a confirmed median sample");
    expect(html).toContain("not the namesake suburb");
    expect(html).toContain("period=2026-06-30");
    expect(html).toContain('tabindex="0"');
  });
  it("does not display a suburb as a council or substitute another period", () => {
    const input = data();
    input.area.kind = "suburb";
    expect(renderRents(input)).toBe("");
    input.area.kind = "LGA";
    input.period = "2026-09-30";
    expect(renderRents(input)).toBe("");
  });
  it("labels old data and missing counts", () => {
    const input = data();
    input.older = true;
    input.area.observations[0]!.sample = null;
    const html = renderRents(input);
    expect(html).toContain("Older reporting period");
    expect(html).toContain("Not supplied");
  });
  it.each([false, true])(
    "keeps navigation targets valid and news counts unchanged, demo=%s",
    (demo) => {
      const file: PublicMarketFile = {
        market: PUBLIC_MARKETS.find((m) => m.slug === "townsville")!,
        asOf: "2026-09-17",
        since: "2026-06-20",
        referenceCount: 1,
        publisherCount: 1,
        latestMention: "2026-09-02",
        coverage: "limited",
        indexable: false,
        references: [],
        councilRents: data(),
      };
      const directory: MarketDirectory = {
        asOf: file.asOf,
        since: file.since,
        sampleLimit: 2000,
        sampleCapped: false,
        demo,
        markets: [file],
      };
      const html = renderToStaticMarkup(createElement(PublicMarketRead, { file, directory }));
      for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) expect(html).toContain(`id="${id}"`);
      expect(html.includes('id="primary-context"')).toBe(!demo);
      expect(html.includes('id="council-rents"')).toBe(!demo);
      expect(file.referenceCount).toBe(1);
      expect(file.coverage).toBe("limited");
    }
  );
});
