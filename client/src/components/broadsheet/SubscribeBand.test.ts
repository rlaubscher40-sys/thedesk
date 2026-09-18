// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const m = vi.hoisted(() => ({ mutate: vi.fn(), track: vi.fn(), options: null as any }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
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
import { NEWSLETTER_NOTICE, NEWSLETTER_NOTICE_VERSION } from "@shared/legal";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);
function open() {
  render(h(SubscribeBand, { source: "test", hideAfterSignup: false }));
}
it("shows the newsletter scope and sends the matching notice version", () => {
  open();
  expect(screen.getByText(NEWSLETTER_NOTICE, { exact: false })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(m.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ noticeVersion: NEWSLETTER_NOTICE_VERSION })
  );
});
it("shows a visible label and inline validation without sending invalid addresses", () => {
  open();
  screen.getByRole("button", { name: "Subscribe" }).focus();
  expect(screen.getByText("Email address").className).not.toContain("sr-only");
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(screen.getByRole("alert").textContent).toContain("valid email");
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.track).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
  screen.getByRole("button", { name: "Subscribe" }).focus();
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
  expect(m.mutate).not.toHaveBeenCalled();
});

it("does not take focus when a passive signup form mounts", () => {
  const focused = document.activeElement;
  open();
  expect(document.activeElement).toBe(focused);
});
it("keeps the submitted address visible and lets the reader correct it", () => {
  open();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "typo@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  act(() => m.options.onSuccess({}, { email: "typo@example.com" }));
  expect(m.track).toHaveBeenCalledExactlyOnceWith("newsletter_request", "subscribe");
  expect(screen.getByRole("status").textContent).toContain("typo@example.com");
  expect(document.activeElement).toBe(screen.getByRole("status"));
  fireEvent.click(screen.getByRole("button", { name: /Edit address/ }));
  expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
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
  expect(m.track).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("try again");
  act(() => m.options.onSuccess({}, { email: "test@example.com" }));
  fireEvent.click(screen.getByRole("button", { name: /Edit address/ }));
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  expect(screen.getByRole("alert").textContent).toContain("wait a minute");
  expect(m.mutate).toHaveBeenCalledTimes(1);
});

it("does not count honeypot acceptance as a reader request", () => {
  open();
  act(() => m.options.onSuccess({}, { email: "bot@example.com", _hp: "filled" }));
  expect(m.track).not.toHaveBeenCalled();
});
