import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ items: [] as unknown[], error: false }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    feed: {
      recentLocal: {
        useQuery: () => ({
          data: state.items,
          isError: state.error,
          refetch: vi.fn(),
          isFetching: false,
        }),
      },
    },
  },
}));
vi.mock("@/lib/useFilteredFeed", () => ({
  useFilteredFeed: (items: Array<{ category: string }>) =>
    items.filter((item) => item.category !== "HIDDEN"),
}));
import { RecentReporting, RecentReportingList } from "./RecentReporting";
const render = () =>
  renderToStaticMarkup(
    createElement(Router, { ssrPath: "/" }, createElement(RecentReporting, { channel: "PROPERTY" }))
  );
it("keeps original dates, related links and topic preferences visible without calling old stories today's news", () => {
  state.error = false;
  const lead = {
    id: 1,
    title: "Housing development approved",
    source: "NSW",
    priority: 80,
    channel: "PROPERTY",
    category: "PROPERTY",
    feedDate: "2026-09-12",
    sourceTiming: null,
  };
  state.items = [
    lead,
    { ...lead, id: 2, priority: 60, threadParentId: 1, title: "Related local reporting" },
    { ...lead, id: 3, category: "HIDDEN", title: "Filtered preference" },
  ];
  const html = render();
  expect(html).toMatch(/datetime="2026-09-12"/i);
  expect(html).toContain("Original publication date not recorded");
  expect(html).toContain('href="/story/1"');
  expect(html).toContain('href="/story/2"');
  expect(html).toContain("<details");
  expect(html).not.toContain("Filtered preference");
  expect(html).not.toContain("today's news");
});
it("distinguishes unavailable reporting from an empty recent section", () => {
  state.items = [];
  state.error = false;
  expect(render()).toBe("");
  expect(renderToStaticMarkup(createElement(RecentReportingList, { items: [] }))).toBe("");
  state.error = true;
  expect(render()).toContain("Try again");
});
