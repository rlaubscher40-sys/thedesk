// @vitest-environment happy-dom
import { createElement as h } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { feedback: { submit: { useMutation: () => ({ mutate: m.mutate, isPending: false }) } } },
}));
import { FeedbackButton } from "./FeedbackButton";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("opens an accessible modal, contains focus and restores the trigger on Escape", async () => {
  render(h("div", null, h("button", null, "Outside"), h(FeedbackButton)));
  const trigger = screen.getByRole("button", { name: "Send feedback" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Send feedback" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(screen.queryByRole("button", { name: "Outside" })).toBeNull();
  const close = within(dialog).getByRole("button", { name: "Close" });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(close);
  fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(m.mutate).not.toHaveBeenCalled();
});
it("still opens and accepts input when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(h(FeedbackButton));
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  const dialog = await screen.findByRole("dialog", { name: "Send feedback" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Your name (optional)" }), {
    target: { value: "Test" },
  });
  expect(
    (within(dialog).getByRole("textbox", { name: "Your name (optional)" }) as HTMLInputElement)
      .value
  ).toBe("Test");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(m.mutate).not.toHaveBeenCalled();
});
