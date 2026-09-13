// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const m = vi.hoisted(() => ({ mutate: vi.fn(), options: null as any }));
vi.mock("@/lib/attribution", () => ({ getArrival: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    subscribers: {
      subscribe: {
        useMutation: (options: unknown) => {
          m.options = options;
          return { mutate: m.mutate, isPending: false };
        },
      },
    },
  },
}));
import { SubscribeBand } from "./SubscribeBand";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);
function open() {
  render(h(SubscribeBand, { source: "test", hideAfterSignup: false }));
}
it("shows a visible label and inline validation without sending invalid addresses", () => {
  open();
  expect(screen.getByText("Email address").className).not.toContain("sr-only");
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(screen.getByRole("alert").textContent).toContain("valid email");
  expect(m.mutate).not.toHaveBeenCalled();
});
it("keeps the submitted address visible and lets the reader correct it", () => {
  open();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "typo@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  act(() => m.options.onSuccess({}, { email: "typo@example.com" }));
  expect(screen.getByRole("status").textContent).toContain("typo@example.com");
  fireEvent.click(screen.getByRole("button", { name: /Edit address/ }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "correct@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(m.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({ email: "correct@example.com" })
  );
});
it("shows service failures inline and rate-limits immediate resend", () => {
  open();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "test@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  act(() => m.options.onError());
  expect(screen.getByRole("alert").textContent).toContain("try again");
  act(() => m.options.onSuccess({}, { email: "test@example.com" }));
  fireEvent.click(screen.getByRole("button", { name: /Edit address/ }));
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(screen.getByRole("alert").textContent).toContain("wait a minute");
  expect(m.mutate).toHaveBeenCalledTimes(1);
});
