// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { metricHealth } from "@shared/metricHealth";
const data = vi.hoisted(() => ({ rows: [] as ReturnType<typeof metricHealth> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    health: {
      metricCoverage: { useQuery: () => ({ data: data.rows }) },
      metricCollection: { useQuery: () => ({}) },
      refreshMetrics: { useMutation: () => ({}) },
    },
  },
}));
import { MetricHealthPanel } from "./MetricHealthPanel";
afterEach(cleanup);

it("opens review for fresh metrics without provenance and only links usable URLs", () => {
  const now = new Date("2026-09-17T06:00:00Z");
  const keys = ["audusd", "audeur", "audgbp"];
  const urls = [null, "javascript:alert(1)", "https://example.com/quotes?symbol=AUDGBP"];
  data.rows = metricHealth(
    keys.map((metricKey, i) => ({
      metricKey,
      label: metricKey,
      asOf: now,
      updatedAt: now,
      source: "Fixture",
      sourceUrl: urls[i],
    })),
    now
  ).filter((row) => keys.includes(row.key));
  const view = render(h(MetricHealthPanel));
  expect(screen.getByText("2 of 3 metrics need review")).toBeTruthy();
  expect(view.container.querySelector("details")?.open).toBe(true);
  expect(screen.getByText("missing source link")).toBeTruthy();
  expect(screen.getByText("invalid source link")).toBeTruthy();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Open source" }).getAttribute("href")).toBe(
    "https://example.com/quotes?symbol=AUDGBP"
  );
  expect(screen.getAllByText("within review window")).toHaveLength(3);
});
