// @vitest-environment happy-dom
import { createElement as h } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/trpc", () => ({
  trpc: {
    editions: { list: { useQuery: () => ({ data: [] }) } },
    search: { all: { useQuery: () => ({ data: { feedItems: [] } }) } },
  },
}));
import { CommandPalette } from "./CommandPalette";
afterEach(cleanup);
it("opens from a keyboard shortcut, focuses search and restores focus after touch dismissal", async () => {
  render(h("div", null, h("button", null, "Reader control"), h(CommandPalette)));
  const trigger = screen.getByRole("button", { name: "Reader control" });
  trigger.focus();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const input = await screen.findByRole("combobox");
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(screen.getByRole("dialog", { name: "Search and jump to" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
it("opens from the search event and closes with Escape", async () => {
  render(h(CommandPalette));
  act(() => {
    window.dispatchEvent(new Event("thedesk:open-search"));
  });
  const input = await screen.findByRole("combobox");
  fireEvent.change(input, { target: { value: "no-matches-here" } });
  expect(screen.getByRole("status").textContent).toContain("No matches");
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
