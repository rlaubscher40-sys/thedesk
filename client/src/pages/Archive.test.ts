// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({ search: vi.fn(), failed: false }));
vi.mock("@/lib/category", () => ({ useCategoryColour: () => () => "black" }));
vi.mock("@/lib/userPrefs", () => ({ useUserPrefs: () => ({ isCategoryAllowed: () => true }) }));
vi.mock("@/lib/trpc", () => {
  const stories = [
    {
      id: 1,
      title: "Sydney housing supply",
      category: "PROPERTY",
      feedDate: "2026-09-10",
      summary: "Homes",
      source: "ABS",
    },
    {
      id: 2,
      title: "Sydney football result",
      category: "OTHER",
      feedDate: "2026-09-09",
      summary: "Score",
      source: "Publisher",
    },
  ];
  return {
    trpc: {
      topics: {
        recentByCategory: {
          useQuery: () => ({ data: { PROPERTY: [stories[0]], OTHER: [stories[1]] } }),
        },
        itemCounts: {
          useQuery: () => ({
            data: [
              { category: "PROPERTY", total: 1 },
              { category: "OTHER", total: 1 },
            ],
          }),
        },
        getByCategory: { useQuery: () => ({ data: { feedItems: stories, editions: [] } }) },
      },
      editions: { list: { useQuery: () => ({ data: [] }) } },
      search: {
        all: {
          useQuery: (input: unknown) => {
            m.search(input);
            return {
              data: {
                feedItems: stories,
                editions: [{ id: 3, editionNumber: 1, weekRange: "Old Sydney edition" }],
              },
              isError: m.failed,
              isLoading: false,
              refetch: vi.fn(),
            };
          },
        },
      },
    },
  };
});
import Archive from "./Archive";
afterEach(() => {
  cleanup();
  m.failed = false;
  vi.clearAllMocks();
});
function open(path: string) {
  const location = memoryLocation({ path });
  render(h(Router, { hook: location.hook, searchHook: location.searchHook }, h(Archive)));
  return location;
}
it("combines keyword and selected category, including the request sent before the result cap", () => {
  open("/archive?q=Sydney&cat=ALL");
  expect(screen.getByRole("link", { name: /Sydney football result/ })).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: /PROPERTY/ })[0]!);
  expect(screen.queryByRole("link", { name: /Sydney football result/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Old Sydney edition/ })).toBeNull();
  expect(m.search).toHaveBeenLastCalledWith(
    expect.objectContaining({ query: "Sydney", category: "PROPERTY" })
  );
});
it("preserves category when clearing query", () => {
  open("/archive?q=Sydney&cat=PROPERTY");
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  expect(screen.getAllByRole("button", { name: /PROPERTY/ })[0]!.getAttribute("aria-pressed")).toBe(
    "true"
  );
});
it("offers retry on search failure instead of claiming no matches", () => {
  m.failed = true;
  open("/archive?q=Sydney&cat=PROPERTY");
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText(/No results for/)).toBeNull();
});
