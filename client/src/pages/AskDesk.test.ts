// @vitest-environment happy-dom
import { createElement as h } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
const m = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn() }));
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
});
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
          "Approvals are permissions. They are not completed homes. Compare the relevant periods.",
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
  expect(screen.getByText("Read the full answer")).toBeTruthy();
  expect(m.mutate).not.toHaveBeenCalled();
});
