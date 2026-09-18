// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const fixture = vi.hoisted(() => ({
  item: {
    id: 99278,
    title: "More than 1,000 homes coming after Caivan Perth development wins approval",
    source: "lanarkleedstoday.ca",
    sourceUrl: "https://news.google.com/rss/articles/fixture",
    summary: "",
    regions: ["WA"],
    publishedAt: "2026-09-02T00:00:00Z",
    excluded: true,
  },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: { evidence: { get: { useQuery: () => ({ data: fixture.item, isLoading: false }) } } },
}));
import Evidence from "./Evidence";
afterEach(cleanup);
it("keeps excluded originals accessible without endorsing the archived region or offering story-specific Ask", () => {
  const location = memoryLocation({ path: "/evidence/99278" });
  render(h(Router, { hook: location.hook }, h(Evidence)));
  expect(
    screen.getByText(/Source evidence · Excluded from Australian market evidence/)
  ).toBeTruthy();
  expect(screen.queryByText(/Source evidence · WA/)).toBeNull();
  expect(screen.getByRole("note").textContent).toContain("excluded from selected market evidence");
  expect(screen.getByText(/Headline-only reference/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Read original source" }).getAttribute("href")).toBe(
    fixture.item.sourceUrl
  );
  expect(screen.queryByRole("link", { name: "Ask about this story" })).toBeNull();
});
