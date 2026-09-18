// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({ search: vi.fn(), retry: vi.fn(), failed: false }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    metrics: new Proxy(
      {},
      { get: () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }) }
    ),
    markets: new Proxy(
      {},
      { get: () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }) }
    ),
    search: {
      all: {
        useQuery: (input: unknown) => {
          m.search(input);
          return {
            data: { feedItems: [], editions: [] },
            isError: m.failed,
            isLoading: false,
            refetch: m.retry,
          };
        },
      },
    },
    ask: { answer: { useMutation: () => ({ reset: vi.fn(), isPending: false }) } },
  },
}));
import Markets from "./Markets";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  m.failed = false;
});
afterEach(cleanup);
function open() {
  const location = memoryLocation({ path: "/markets?q=Mildura" });
  render(h(Router, { hook: location.hook, searchHook: location.searchHook }, h(Markets)));
}
it("searches Australian reporting and distinguishes a failed request from an empty market", () => {
  m.failed = true;
  open();
  expect(m.search).toHaveBeenCalledWith({ query: "Mildura", region: "AU" });
  expect(screen.queryByText(/No archived reporting/)).toBeNull();
  expect(
    within(screen.getByRole("region", { name: "Reporting search summary" })).getAllByText(
      "Unavailable"
    )
  ).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(m.retry).toHaveBeenCalledOnce();
});
it("keeps the visible watchlist consistent with its persisted twelve-market limit", () => {
  localStorage.setItem(
    "thedesk:market-watchlist:v1",
    JSON.stringify(Array.from({ length: 12 }, (_, i) => `Place ${i}`))
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "Watch market" }));
  const saved = JSON.parse(localStorage.getItem("thedesk:market-watchlist:v1")!);
  expect(saved).toHaveLength(12);
  expect(saved[0]).toBe("Mildura");
  expect(screen.queryByRole("button", { name: "Place 11" })).toBeNull();
  expect(screen.getByText("12")).toBeTruthy();
});
it("retains council filters while exposing canonical reporting and primary notes", () => {
  const location = memoryLocation({
    path: "/markets?q=Townsville%20(C)&state=QLD&areaKind=LGA&period=2026-06-30",
  });
  render(h(Router, { hook: location.hook, searchHook: location.searchHook }, h(Markets)));
  expect(m.search).toHaveBeenCalledWith({ query: "Townsville", region: "AU" });
  expect(
    screen
      .getByRole("link", { name: "Open the complete Townsville market file →" })
      .getAttribute("href")
  ).toBe("/markets/townsville");
  expect(screen.getByText(/and period 2026-06-30/)).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Social and affordable housing construction" })
  ).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Market name" }).getAttribute("value")).toBe(
    "Townsville (C)"
  );
});
