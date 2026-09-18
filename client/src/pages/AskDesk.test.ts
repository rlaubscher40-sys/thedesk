// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn(), track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
vi.mock("@/lib/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ask: {
      answer: {
        useMutation: () => ({
          isIdle: true,
          isPending: false,
          data: undefined,
          error: null,
          mutate: m.mutate,
          reset: m.reset,
        }),
      },
    },
  },
}));
vi.mock("@/components/ask/ShareIntelligenceCardButton", () => ({
  ShareIntelligenceCardButton: () => null,
}));
import AskDesk from "./AskDesk";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function open(cache: QueryClient, path = "/ask") {
  const location = memoryLocation({ path });
  return render(
    h(
      QueryClientProvider,
      { client: cache },
      h(Router, { hook: location.hook, searchHook: location.searchHook }, h(AskDesk))
    )
  );
}
it("prepares a story question without automatically spending an answer", () => {
  open(new QueryClient(), "/ask?story=42&q=What%20does%20housing%20supply%20mean%3F");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
    "What does housing supply mean?"
  );
  expect(screen.getByRole("link", { name: "this story" }).getAttribute("href")).toBe("/story/42");
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.track).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  expect(m.mutate.mock.calls[0]?.[0]).toEqual({
    question: "What does housing supply mean?",
    storyId: 42,
  });
});

it.each(["answered", "unavailable", "error"])(
  "records the actual %s outcome separately from submitting",
  (status) => {
    open(new QueryClient());
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "What changed in housing?" },
    });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(m.track).toHaveBeenCalledExactlyOnceWith("ask_query", "ask");
    const callbacks = m.mutate.mock.calls[0]![1];
    act(() => {
      if (status === "error") callbacks.onError(new Error("offline"));
      else
        callbacks.onSuccess({
          status,
          searchedRecords: 0,
          sources: [],
          ...(status === "answered"
            ? {
                answer: {
                  headline: "A response",
                  answer: "Evidence",
                  signals: [],
                  whyItMatters: "Context",
                  deskTake: "Read sources",
                  whatWouldChangeOurMind: "New evidence",
                  confidence: "moderate",
                },
              }
            : {}),
        });
      callbacks.onSettled();
    });
    expect(m.track).toHaveBeenLastCalledWith(
      status === "answered" ? "ask_answer" : status === "error" ? "ask_error" : "ask_unavailable",
      "ask"
    );
    expect(JSON.stringify(m.track.mock.calls)).not.toContain("housing");
  }
);
it("restores a completed brief after navigating away and back without regeneration", () => {
  const cache = new QueryClient();
  cache.setQueryData(["desk-completed-brief", "guest"], {
    question: "What changed?",
    result: {
      status: "answered",
      searchedRecords: 1,
      anonymousRemaining: 2,
      shareToken: "test",
      sources: [],
      answer: {
        headline: "Housing supply remains constrained",
        answer:
          "NSW unemployment was 4.2%. The observation is trend, July 2026. Queensland unemployment was 4.2%. The observation is trend, July 2026.",
        signals: [],
        whyItMatters: "Timing matters.",
        deskTake: "Read the dates.",
        whatWouldChangeOurMind: "New completions.",
        confidence: "moderate",
      },
    },
  });
  const view = open(cache);
  expect(screen.getByRole("heading", { name: "Housing supply remains constrained" })).toBeTruthy();
  view.unmount();
  open(cache);
  expect(screen.getByRole("heading", { name: "Housing supply remains constrained" })).toBeTruthy();
  const comparison = screen.getByText(
    /NSW unemployment was 4.2%.*Queensland unemployment was 4.2%/
  );
  expect(comparison.closest("details")).toBeNull();
  expect(screen.queryByText("Read the full answer")).toBeNull();
  expect(m.mutate).not.toHaveBeenCalled();
});
