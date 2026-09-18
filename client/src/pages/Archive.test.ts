// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({
  search: vi.fn(),
  category: vi.fn(),
  failed: false,
  pageable: false,
  countFailed: false,
  more: false,
}));
vi.mock("@/lib/category", () => ({ useCategoryColour: () => () => "black" }));
vi.mock("@/lib/userPrefs", () => ({ useUserPrefs: () => ({ isCategoryAllowed: () => true }) }));
vi.mock("@/lib/trpc", () => {
  const stories = [
    {
      id: 1,
      title: "Sydney housing supply",
      category: "PROPERTY",
      feedDate: "2026-09-10",
      summary: "Some offers on this page are from advertisers who pay us.",
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
            isError: m.countFailed,
            data: [
              { category: "PROPERTY", total: 1 },
              { category: "OTHER", total: 1 },
            ],
          }),
        },
        getByCategory: {
          useQuery: (input: any) => {
            m.category(input);
            return {
              data: {
                feedItems: input.before
                  ? [{ ...stories[0], id: 3, title: "Older housing evidence" }]
                  : stories,
                editions: [],
                nextCursor: m.pageable && !input.before ? { feedDate: "2026-09-09", id: 2 } : null,
              },
            };
          },
        },
      },
      editions: { list: { useQuery: () => ({ data: [] }) } },
      search: {
        all: {
          useQuery: (input: unknown) => {
            m.search(input);
            return {
              data: {
                hasMoreFeedItems: m.more,
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
  m.pageable = false;
  m.countFailed = false;
  m.more = false;
  vi.clearAllMocks();
});

it("pages older stories with the active date/coverage filters and resets the cursor when filters change", () => {
  m.pageable = true;
  open("/archive?cat=PROPERTY&region=AU&since=2026-09-01");
  const older = screen.getByRole("link", { name: "Older stories →" });
  expect(older.getAttribute("href")).toContain("since=2026-09-01");
  fireEvent.click(older);
  expect(screen.getByRole("link", { name: /Older housing evidence/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Older stories →" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Archive results" }));
  expect(m.category).toHaveBeenLastCalledWith(
    expect.objectContaining({
      limit: 40,
      region: "AU",
      since: "2026-09-01",
      before: { feedDate: "2026-09-09", id: 2 },
    })
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Coverage" }), {
    target: { value: "ALL" },
  });
  expect(m.category).toHaveBeenLastCalledWith(
    expect.objectContaining({ before: undefined, region: "ALL" })
  );
});
it("ignores malformed deep-link cursors and displays publisher provenance in browse rows", () => {
  open("/archive?cat=PROPERTY&before=2026-02-30&beforeId=2");
  expect(m.category).toHaveBeenLastCalledWith(expect.objectContaining({ before: undefined }));
  expect(screen.getByText("Source: ABS")).toBeTruthy();
});
it("labels capped results and unavailable corpus counts honestly", () => {
  m.more = true;
  m.countFailed = true;
  open("/archive?q=Sydney&cat=PROPERTY");
  expect(screen.getByText("Unavailable")).toBeTruthy();
  expect(screen.getByText(/More matches are available/)).toBeTruthy();
  expect(screen.getByText(/Daily items · 1 shown/)).toBeTruthy();
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
  const announcements = screen.getAllByRole("status").map((node) => node.textContent);
  expect(announcements).toContain("Reporting search unavailable");
  expect(announcements.some((text) => text?.includes("0 results"))).toBe(false);
});

it("defaults to Australia and preserves keyword, category and date when changing coverage", () => {
  open("/archive?q=Sydney&cat=PROPERTY&since=2026-09-01");
  expect(m.search).toHaveBeenLastCalledWith(expect.objectContaining({ region: "AU" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Coverage" }), {
    target: { value: "INTERNATIONAL" },
  });
  expect(m.search).toHaveBeenLastCalledWith(
    expect.objectContaining({
      query: "Sydney",
      category: "PROPERTY",
      since: "2026-09-01",
      region: "INTERNATIONAL",
    })
  );
});

it("omits scraped advertising copy from existing browse and search rows", () => {
  open("/archive?cat=PROPERTY");
  expect(screen.getByRole("link", { name: /Sydney housing supply/ })).toBeTruthy();
  expect(screen.queryByText(/Some offers on this page/)).toBeNull();
  cleanup();
  open("/archive?q=Sydney&cat=PROPERTY");
  expect(screen.queryByText(/Some offers on this page/)).toBeNull();
});
