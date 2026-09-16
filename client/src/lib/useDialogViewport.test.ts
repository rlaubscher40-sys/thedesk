// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDialogViewport } from "./useDialogViewport";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function viewport() {
  const view = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal("visualViewport", view);
  return view;
}
it("follows keyboard shrink and pan, then releases listeners", () => {
  const view = viewport();
  const removed = vi.spyOn(view, "removeEventListener");
  const { result, unmount } = renderHook(() => useDialogViewport(true));
  expect(result.current.top).toBe(400);
  act(() => {
    view.height = 320;
    view.offsetTop = 90;
    view.dispatchEvent(new Event("resize"));
  });
  expect(result.current.top).toBe(250);
  expect(result.current.maxHeight).toContain("320px");
  act(() => {
    view.offsetTop = 120;
    view.dispatchEvent(new Event("scroll"));
  });
  expect(result.current.top).toBe(280);
  unmount();
  expect(removed).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(removed).toHaveBeenCalledWith("scroll", expect.any(Function));
});
it("does not fight pinch zoom or use invalid viewport heights", () => {
  const view = viewport();
  const { result } = renderHook(() => useDialogViewport(true));
  act(() => {
    view.scale = 2;
    view.height = 400;
    view.dispatchEvent(new Event("resize"));
  });
  expect(result.current.top).toBe(400);
  act(() => {
    view.scale = 1;
    view.height = 0;
    view.dispatchEvent(new Event("resize"));
  });
  expect(result.current.top).toBe(400);
});
it("retains CSS fallback without the API and avoids listeners when disabled", () => {
  vi.stubGlobal("visualViewport", null);
  expect(renderHook(() => useDialogViewport(true)).result.current).toEqual({});
  const view = viewport();
  const added = vi.spyOn(view, "addEventListener");
  expect(renderHook(() => useDialogViewport(false)).result.current).toEqual({});
  expect(added).not.toHaveBeenCalled();
});
