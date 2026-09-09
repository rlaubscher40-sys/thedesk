import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    metrics: {
      list: {
        useQuery: () => ({
          data: [
            {
              metricKey: "cash_rate",
              label: "RBA cash rate",
              value: "4.35",
              unit: "%",
              asOf: new Date("2025-01-01"),
              updatedAt: new Date("2026-09-09T07:00:00Z"),
              source: "RBA",
              groupKey: "MACRO",
              context: null,
            },
          ],
        }),
      },
      histories: { useQuery: () => ({ data: {} }) },
    },
    editions: { list: { useQuery: () => ({ data: [] }) } },
  },
}));
vi.mock("@/components/signals/ShareSignalCardButton", () => ({
  ShareSignalCardButton: () => null,
}));
vi.mock("@/components/trends/ShareMetricCardButton", () => ({ ShareMetricCardButton: () => null }));
vi.mock("@/components/planning/NswPlanningRead", () => ({ NswPlanningPanel: () => null }));
import SignalsPage from "./Signals";
import { Router } from "wouter";

afterEach(() => vi.useRealTimers());
it("dates the hero and board, labels an old observation, and sends its date to Ask", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
  const html = renderToStaticMarkup(
    React.createElement(Router, { ssrPath: "/signals" }, React.createElement(SignalsPage))
  );
  expect(html.match(/datetime="2025-01-01"/gi)).toHaveLength(2);
  expect(html.match(/Older reporting period/g)).toHaveLength(2); // hero and board
  expect(html).toContain("1 recorded metric");
  expect(html).not.toContain("live metric");
  expect(html).not.toContain("The live board");
  const href = html.match(/href="(\/ask\?q=[^"]+)"/)![1]!;
  const question = new URL(href, "https://thedesk.au").searchParams.get("q");
  expect(question).toContain("4.35% as of 2025-01-01");
  expect(question).not.toContain("right now");
});
