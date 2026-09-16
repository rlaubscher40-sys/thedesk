// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const m = vi.hoisted(() => ({ errors: {} as any, pings: {} as any }));
vi.mock("./EditorialHealth", () => ({ EditorialHealth: () => null }));
vi.mock("./CoverageReview", () => ({ CoverageReview: () => null }));
vi.mock("./MetricHealthPanel", () => ({ MetricHealthPanel: () => null }));
vi.mock("./DailyBriefHealth", () => ({ DailyBriefHealth: () => null }));
vi.mock("./FeedEnrichmentHealth", () => ({ FeedEnrichmentHealth: () => null }));
vi.mock("./LocalDataHealth", () => ({ LocalDataHealth: () => null }));
vi.mock("./PropertyCoveragePanel", () => ({ PropertyCoveragePanel: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    health: {
      summary: { useQuery: () => ({}) },
      recentErrors: { useQuery: () => m.errors },
      uptimePings: { useQuery: () => m.pings },
      clearErrors: { useMutation: () => ({}) },
    },
  },
}));
import { HealthAdminPanel } from "./HealthAdminPanel";
beforeEach(() => {
  m.errors = {};
  m.pings = {};
});
afterEach(cleanup);
it("does not present failed history requests as a quiet system, even with cached empty data", () => {
  m.errors = { isError: true, data: [] };
  m.pings = { isError: true, data: [] };
  render(h(HealthAdminPanel));
  expect(screen.queryByText("No errors recorded.")).toBeNull();
  expect(screen.getAllByRole("alert").map((e) => e.textContent)).toEqual([
    "Recent monitoring checks are unavailable. Any displayed history may be stale.",
    "Error history is unavailable. Retry with Refresh.",
  ]);
  expect(screen.queryByRole("button", { name: "Clear log" })).toBeNull();
});
it("distinguishes loading history from a successfully loaded empty error log", () => {
  m.errors = { isPending: true };
  const view = render(h(HealthAdminPanel));
  expect(screen.getByRole("status").textContent).toContain("Loading error history");
  expect(screen.queryByText("No errors recorded.")).toBeNull();
  m.errors = { data: [], isPending: false };
  view.rerender(h(HealthAdminPanel));
  expect(screen.getByText("No errors recorded.")).toBeTruthy();
});
