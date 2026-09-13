// @vitest-environment happy-dom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePageScroll } from "./usePageScroll";

let offset = 0;
let maxOffset = Infinity;
beforeEach(() => {
  offset = 0;
  maxOffset = Infinity;
  history.replaceState(null, "", "/");
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => offset });
  vi.spyOn(window, "scrollTo").mockImplementation((options) => {
    if (typeof options === "object") offset = Math.min(maxOffset, options.top ?? 0);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("uses document scroll events and restores each route, including query variants", () => {
  const view = renderHook(({ route }) => usePageScroll(route), {
    initialProps: { route: "/?date=2026-09-12" },
  });
  offset = 720;
  fireEvent.scroll(window);
  expect(view.result.current).toBe(true);
  view.rerender({ route: "/story/42?" });
  expect(offset).toBe(0);
  expect(view.result.current).toBe(false);
  offset = 120;
  fireEvent.scroll(window);
  view.rerender({ route: "/?date=2026-09-13" });
  expect(offset).toBe(0);
  view.rerender({ route: "/?date=2026-09-12" });
  expect(offset).toBe(720);
});

it("preserves a saved offset while a lazy page is too short and yields to touch", () => {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame");
  const view = renderHook(({ route }) => usePageScroll(route), {
    initialProps: { route: "/archive" },
  });
  offset = 900;
  fireEvent.scroll(window);
  view.rerender({ route: "/story/42" });
  maxOffset = 200;
  view.rerender({ route: "/archive" });
  fireEvent.scroll(window);
  maxOffset = 1200;
  act(() => frame?.(0));
  expect(offset).toBe(900);
  view.rerender({ route: "/story/42" });
  maxOffset = 200;
  view.rerender({ route: "/archive" });
  fireEvent.touchStart(window);
  expect(cancel).toHaveBeenCalledWith(1);
  offset = 150;
  fireEvent.scroll(window);
  view.rerender({ route: "/story/42" });
  maxOffset = 1200;
  view.rerender({ route: "/archive" });
  expect(offset).toBe(150);
});

it("leaves evidence fragment positioning intact and restores browser settings on unmount", () => {
  history.scrollRestoration = "auto";
  history.replaceState(null, "", "/markets/sydney#housing-approvals");
  offset = 650;
  const view = renderHook(() => usePageScroll("/markets/sydney?"));
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(offset).toBe(650);
  expect(history.scrollRestoration).toBe("manual");
  view.unmount();
  expect(history.scrollRestoration).toBe("auto");
});

it("keeps the caret and viewport while search updates the URL on each keystroke", () => {
  const input = document.createElement("input");
  document.body.append(input);
  const view = renderHook(({ route }) => usePageScroll(route), {
    initialProps: { route: "/archive?q=h" },
  });
  input.focus();
  offset = 250;
  fireEvent.scroll(window);
  view.rerender({ route: "/archive?q=ho" });
  expect(document.activeElement).toBe(input);
  expect(offset).toBe(250);
  view.rerender({ route: "/archive?q=hou" });
  expect(document.activeElement).toBe(input);
  expect(offset).toBe(250);
  input.remove();
});

it("restores again when a later layout clamps an already reached position", () => {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  const view = renderHook(({ route }) => usePageScroll(route), { initialProps: { route: "/?" } });
  offset = 662;
  fireEvent.scroll(window);
  view.rerender({ route: "/story/42?" });
  view.rerender({ route: "/?" });
  expect(offset).toBe(662);
  // A late placeholder commit clamps the document after the first restore.
  offset = 234;
  fireEvent.scroll(window);
  act(() => frame?.(0));
  expect(offset).toBe(662);
  // Intentional interaction must immediately take control of scrolling.
  fireEvent.pointerDown(window);
  offset = 500;
  fireEvent.scroll(window);
  view.rerender({ route: "/story/42?" });
  view.rerender({ route: "/?" });
  expect(offset).toBe(500);
});
