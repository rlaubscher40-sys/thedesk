import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { SignalSnapshot } from "@shared/signalSnapshot";
const sharedState = vi.hoisted(() => ({ data: null as SignalSnapshot | null, isError: false, isLoading: false }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    metrics: {
      shared: { useQuery: () => sharedState },
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

afterEach(() => { vi.useRealTimers(); sharedState.data = null; sharedState.isError = false; });
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

function renderSearch(search: string) {
  return renderToStaticMarkup(React.createElement(Router, { ssrPath: `/signals?${search}` }, React.createElement(SignalsPage)));
}

it("shows a gap for a missing shared signal without a substitute hero", () => {
  const html = renderSearch("metric=missing");
  expect(html).toContain("That shared observation is unavailable");
  expect(html).not.toContain("Ask what it means");
  expect(html).not.toContain("Showing another recorded signal");
});

it("renders saved evidence despite a different live value and retains its chart link", () => {
  sharedState.data = { version: 1, metric: {
    metricKey: "cash_rate", label: "RBA cash rate", value: "3.5", unit: "%", source: "Saved RBA",
    sourceUrl: null, previousValue: null, context: "Saved context", asOf: new Date("2024-01-01Z"),
    updatedAt: new Date("2024-01-02Z"),
  }, series: [{ value: 3.4, recordedAt: new Date("2023-12-01Z") }, { value: 3.5, recordedAt: new Date("2024-01-01Z") }],
  move: "Saved change", deskTake: "Original edition take", editionNumber: 6 };
  const id = "a".repeat(64);
  const html = renderSearch(`metric=cash_rate&snapshot=${id}`);
  expect(html).toContain("Saved shared observation");
  expect(html).toContain("Saved RBA");
  expect(html).toContain("Original edition take");
  expect(html).toContain(encodeURIComponent("3.5% as of 2024-01-01"));
  expect(html).toContain(`snapshot=${id}&amp;view=chart`);
});

it.each(["snapshot=invalid", `snapshot=${"a".repeat(64)}`, `metric=cash_rate&snapshot=${"b".repeat(64)}`])(
  "does not replace unavailable snapshot requests (%s) with live data", search => {
    const html = renderSearch(search);
    expect(html).toContain("That shared observation is unavailable");
    expect(html).not.toContain("Ask what it means");
  }
);

it("distinguishes a failed evidence read from missing evidence", () => {
  sharedState.isError = true;
  const html = renderSearch(`metric=cash_rate&snapshot=${"a".repeat(64)}`);
  expect(html).toContain("could not be retrieved");
  expect(html).not.toContain("Ask what it means");
});
