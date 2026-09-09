import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, it, vi } from "vitest";
import { LocalMarketData } from "./LocalMarketData";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    markets: {
      localData: {
        useQuery: () => ({
          data: {
            matches: [
              {
                sourceKey: "qld-bond-rents",
                period: "2026-06-30",
                older: false,
                retrievedAt: "2026-09-09",
                resourceUrl: "https://example.org/rents.xlsx",
                area: {
                  id: "QLD:postcode:4000",
                  name: "4000",
                  state: "QLD",
                  kind: "postcode",
                  boundaryVersion: "Publisher postcode",
                  observations: [
                    {
                      measure: "weekly-rent",
                      category: "Flat 2",
                      value: 850,
                      unit: "AUD/week",
                      period: "2026-06-30",
                      sample: 287,
                      status: "published",
                    },
                    {
                      measure: "weekly-rent",
                      category: "Flat 2",
                      value: 800,
                      unit: "AUD/week",
                      period: "2025-06-30",
                      sample: 345,
                      status: "published",
                    },
                  ],
                },
              },
            ],
          },
        }),
      },
    },
    metrics: { planningPilot: { useQuery: () => ({}) } },
  },
}));

// Also support local Vitest installations using the classic JSX transform.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const render = (period?: string) =>
  renderToStaticMarkup(
    React.createElement(LocalMarketData, {
      query: "4000",
      state: "QLD",
      kind: "postcode",
      period,
    }),
  );

it("shows the latest period when no citation period was requested", () => {
  const html = render();
  expect(html).toContain("$850 / week");
  expect(html).not.toContain("$800 / week");
});
it("opens the historical observation cited by Ask, with a historical notice", () => {
  const html = render("2025-06-30");
  expect(html).toContain("$800 / week");
  expect(html).toContain("Quarter ended 30 June 2025");
  expect(html).toContain("Historical reporting period");
  expect(html).not.toContain("$850 / week");
});
it("discloses a missing historical period without substituting a newer figure", () => {
  const html = render("2025-03-31");
  expect(html).toContain(
    "No observations are stored for the requested reporting period",
  );
  expect(html).not.toContain("$850 / week");
  expect(html).not.toContain("$800 / week");
});
