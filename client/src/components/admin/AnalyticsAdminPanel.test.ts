// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
const m = vi.hoisted(() => ({ journey: {} as any }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    analytics: Object.fromEntries(
      ["summary", "breakdown", "byDay", "engagement", "journey"].map((name) => [
        name,
        { useQuery: () => (name === "journey" ? m.journey : {}) },
      ])
    ),
  },
}));
import { AnalyticsAdminPanel } from "./AnalyticsAdminPanel";
afterEach(cleanup);
it("distinguishes unavailable measurements from a measured zero", () => {
  m.journey = { data: { available: false } };
  const view = render(h(AnalyticsAdminPanel));
  const section = screen.getByLabelText("Reader actions by session");
  expect(within(section).getByRole("alert").textContent).toContain("unavailable");
  expect(within(section).queryByText("0")).toBeNull();
  m.journey = {
    data: {
      available: true,
      sessions: 0,
      stories: 0,
      sources: 0,
      questions: 0,
      answers: 0,
      requests: 0,
      research: 0,
      confirmations: 0,
    },
  };
  view.rerender(h(AnalyticsAdminPanel));
  expect(within(section).queryByRole("alert")).toBeNull();
  expect(within(section).getAllByText("0")).toHaveLength(7);
  expect(section.textContent).toContain("email request is not confirmation");
});
it("warns when a refresh fails even if an earlier measurement remains", () => {
  m.journey = {
    isError: true,
    data: {
      available: true,
      sessions: 3,
      stories: 2,
      sources: 1,
      questions: 1,
      answers: 0,
      requests: 0,
      research: 0,
      confirmations: 0,
    },
  };
  render(h(AnalyticsAdminPanel));
  expect(screen.getByRole("alert").textContent).toContain("unavailable");
});
