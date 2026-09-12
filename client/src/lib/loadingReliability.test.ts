import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { preferenceStorage } from "./storage";
import { ThemeProvider } from "./theme";
import { PersonaProvider } from "./persona";
import { queryFetch } from "./queryFetch";
import { DeadlineError } from "@shared/requestDeadline";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("renders theme/persona providers when access to local storage throws", () => {
  vi.stubGlobal("window", {
    get localStorage() { throw new Error("SecurityError"); },
    matchMedia: () => ({ matches: false }),
  });
  expect(preferenceStorage.getItem("theme")).toBeNull();
  expect(() => preferenceStorage.setItem("theme", "dark")).not.toThrow();
  expect(() => preferenceStorage.removeItem("theme")).not.toThrow();
  expect(renderToString(createElement(ThemeProvider, null,
    createElement(PersonaProvider, null, "Reading remains available")))).toContain("Reading remains available");
});

it("ignores write failures after quota is exhausted", () => {
  vi.stubGlobal("window", { localStorage: { setItem() { throw new Error("QuotaExceededError"); } } });
  expect(() => preferenceStorage.setItem("key", "value")).not.toThrow();
});

describe("query fetch deadline", () => {
  it("returns the body and clears the timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { "Content-Type": "application/json" } })));
    const result = await queryFetch("https://thedesk.au/api/trpc/feed.list");
    expect(await result.json()).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts a request that never returns headers", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_input, init) => { signal = init.signal; return new Promise(() => {}); }));
    const rejected = expect(queryFetch("https://thedesk.au/api/trpc/feed.list")).rejects.toBeInstanceOf(DeadlineError);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(signal.aborted).toBe(true);
  });
  it("also bounds a stalled body after headers arrived", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ arrayBuffer: () => new Promise(() => {}) }));
    const rejected = expect(queryFetch("https://thedesk.au/api/trpc/feed.list")).rejects.toBeInstanceOf(DeadlineError);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
  });
  it("preserves caller cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    })));
    const error = new Error("cancelled");
    const result = queryFetch("https://thedesk.au/api/trpc/feed.list", { signal: controller.signal });
    controller.abort(error);
    await expect(result).rejects.toBe(error);
  });
});
