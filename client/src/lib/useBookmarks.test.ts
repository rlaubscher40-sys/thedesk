// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({
  user: null as { id: number } | null,
  rows: [] as Array<{ id: number; feedItemId: number }>,
  add: vi.fn(),
  remove: vi.fn(),
  invalidate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ user: m.user, isLoading: false }) }));
vi.mock("sonner", () => ({ toast: { error: m.error, info: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ readingQueue: { invalidate: m.invalidate, list: { reset: vi.fn() } } }),
    readingQueue: {
      list: { useQuery: () => ({ data: m.rows, isSuccess: true, isFetching: false }) },
      add: { useMutation: () => ({ mutateAsync: m.add }) },
      remove: { useMutation: () => ({ mutateAsync: m.remove }) },
    },
  },
}));
import { BookmarkProvider, useBookmarks } from "./useBookmarks";
function Consumer({ label }: { label: string }) {
  const saved = useBookmarks();
  return h(
    "button",
    { onClick: () => saved.toggle("42"), "aria-pressed": saved.isBookmarked("42") },
    `${label}: ${saved.count}`
  );
}
function app() {
  return h(
    BookmarkProvider,
    null,
    h(Consumer, { label: "Story" }),
    h(Consumer, { label: "Header" })
  );
}
beforeEach(() => {
  localStorage.clear();
  m.user = null;
  m.rows = [];
  vi.clearAllMocks();
  m.invalidate.mockResolvedValue(undefined);
  m.add.mockImplementation(async ({ feedItemId }) => {
    if (!m.rows.some((row) => row.feedItemId === feedItemId))
      m.rows = [...m.rows, { id: feedItemId + 100, feedItemId }];
  });
  m.remove.mockImplementation(async ({ id }) => {
    m.rows = m.rows.filter((row) => row.id !== id);
  });
});
afterEach(cleanup);
it("synchronises guest saves in the same tab and after remount", () => {
  const view = render(app());
  fireEvent.click(screen.getByText("Story: 0"));
  expect(screen.getByText("Header: 1").getAttribute("aria-pressed")).toBe("true");
  view.unmount();
  render(app());
  expect(screen.getByText("Story: 1")).toBeTruthy();
  fireEvent.click(screen.getByText("Header: 1"));
  expect(screen.getByText("Story: 0")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("thedesk:local-bookmarks")!)).toEqual([]);
});
it("adds and removes signed-in saves through the server queue", async () => {
  m.user = { id: 7 };
  render(app());
  fireEvent.click(screen.getByText("Story: 0"));
  await waitFor(() => expect(m.rows).toEqual([{ id: 142, feedItemId: 42 }]));
  await waitFor(() => expect(screen.getByText("Header: 1")).toBeTruthy());
  await act(async () => {});
  fireEvent.click(screen.getByText("Story: 1"));
  await waitFor(() => expect(screen.getByText("Header: 0")).toBeTruthy());
  expect(m.remove).toHaveBeenCalledWith({ id: 142 });
});
it("imports guest saves once even with multiple consumers and retains failed imports", async () => {
  localStorage.setItem("thedesk:local-bookmarks", '["42","43"]');
  m.user = { id: 7 };
  m.add.mockImplementation(async ({ feedItemId }) => {
    if (feedItemId === 43) throw new Error("offline");
    m.rows = [{ id: 142, feedItemId: 42 }];
  });
  render(app());
  await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem("thedesk:local-bookmarks")!)).toEqual(["43"])
  );
  expect(m.error).toHaveBeenCalled();
});
it("rolls a failed authenticated save back and tells the reader", async () => {
  m.user = { id: 7 };
  m.add.mockRejectedValue(new Error("offline"));
  render(app());
  fireEvent.click(screen.getByText("Story: 0"));
  await waitFor(() => expect(m.error).toHaveBeenCalled());
  expect(screen.getByText("Header: 0").getAttribute("aria-pressed")).toBe("false");
});
it("stops guest import when the active account changes", async () => {
  localStorage.setItem("thedesk:local-bookmarks", '["42","43"]');
  m.user = { id: 7 };
  let finish!: () => void;
  m.add.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const view = render(app());
  await waitFor(() => expect(m.add).toHaveBeenCalledTimes(1));
  m.user = null;
  view.rerender(app());
  await act(async () => finish());
  expect(m.add).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem("thedesk:local-bookmarks")!)).toEqual(["42", "43"]);
});
