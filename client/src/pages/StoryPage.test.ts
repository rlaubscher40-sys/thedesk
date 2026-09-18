// @vitest-environment happy-dom
import { createElement as h, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({
  track: vi.fn(),
  mark: vi.fn(),
  query: { data: undefined as any, isLoading: false, isError: false },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
vi.mock("@/lib/useReadStories", () => ({ markStoryRead: m.mark }));
vi.mock("@/lib/useBookmarks", () => ({
  useBookmarks: () => ({ isBookmarked: () => false, toggle: vi.fn() }),
}));
vi.mock("@/lib/category", () => ({ useCategoryColour: () => () => "red" }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    feed: {
      getById: { useQuery: () => m.query },
      getByDate: { useQuery: () => ({ data: [] }) },
    },
  },
}));
vi.mock("@/components/broadsheet/MetricBlocks", () => ({
  CashRatePanel: () => null,
  MetricRows: () => null,
}));
vi.mock("@/components/broadsheet/SubscribeBand", () => ({ SubscribeBand: () => null }));
vi.mock("@/components/broadsheet/ReaderAngles", () => ({ ReaderAngleColumns: () => null }));
vi.mock("@/components/LinkedInPostModal", () => ({ LinkedInPostModal: () => null }));
vi.mock("@/components/share/StoryShareButton", () => ({ StoryShareButton: () => null }));
vi.mock("@/components/share/DeskTakeShareButton", () => ({ DeskTakeShareButton: () => null }));
import StoryPage from "./StoryPage";
const story = {
  id: 42,
  title: "A housing report",
  source: "Publisher",
  sourceUrl: "https://example.com/report",
  feedDate: "2026-09-16",
  category: "PROPERTY",
  summary: "An evidence-based summary.",
  partnerTag: null,
};
function open(path = "/story/42") {
  const location = memoryLocation({ path });
  const page = () =>
    h(
      StrictMode,
      null,
      h(Router, { hook: location.hook }, h(Route, { path: "/story/:id" }, h(StoryPage)))
    );
  const view = render(page());
  return { ...view, refresh: () => view.rerender(page()), navigate: location.navigate };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.query = { data: undefined, isLoading: false, isError: false };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("does not mark pending, missing, failed or invalid stories read", () => {
  m.query.isLoading = true;
  const view = open();
  m.query.isLoading = false;
  view.refresh();
  expect(screen.getByRole("heading", { name: "Story not found." })).toBeTruthy();
  m.query.isError = true;
  view.refresh();
  expect(m.mark).not.toHaveBeenCalled();
  expect(m.track).not.toHaveBeenCalled();
  act(() => view.navigate("/story/42invalid"));
  expect(screen.getByRole("heading", { name: "Invalid story id" })).toBeTruthy();
});
it("marks and measures a successfully loaded story without refetch or StrictMode double counts", () => {
  m.query.data = story;
  const view = open();
  expect(m.mark).toHaveBeenCalledWith(42);
  expect(m.track).toHaveBeenCalledExactlyOnceWith("story_open", "story");
  m.query.data = { ...story };
  view.refresh();
  expect(m.track).toHaveBeenCalledTimes(1);
});
it("counts a story only after a pending request has returned it", () => {
  m.query.isLoading = true;
  const view = open();
  expect(m.track).not.toHaveBeenCalled();
  m.query = { data: story, isLoading: false, isError: false };
  view.refresh();
  expect(screen.getByRole("heading", { name: story.title })).toBeTruthy();
  expect(m.track).toHaveBeenCalledExactlyOnceWith("story_open", "story");
});
it("records source and Ask actions without transmitting story content", () => {
  m.query.data = story;
  open();
  m.track.mockClear();
  const source = screen.getByRole("link", { name: /Read original reporting/ });
  source.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(source);
  fireEvent.click(screen.getByRole("link", { name: "Ask about this story" }));
  expect(m.track.mock.calls).toEqual([
    ["story_source", "story"],
    ["story_ask", "story"],
  ]);
});

it("does not label a generic stored talking point as personalised reader guidance", () => {
  m.query.data = { ...story, sayThis: "A forecast remains a forecast." };
  open();
  expect(screen.getByText("The line worth remembering")).toBeTruthy();
  expect(screen.queryByText(/The line worth remembering.*If you're/)).toBeNull();
});
