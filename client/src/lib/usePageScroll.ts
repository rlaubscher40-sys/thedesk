import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** The document is the scroll container on both desktop and mobile. */
export function usePageScroll(routeKey: string) {
  const positions = useRef(new Map<string, number>());
  const previousPath = useRef<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const path = routeKey.split("?")[0] ?? "";
    const samePage = previousPath.current === path;
    previousPath.current = path;
    const active = document.activeElement;
    // Archive updates its URL on every keystroke. Keep the caret, keyboard
    // and viewport in place while editing query-backed controls.
    const editing =
      samePage &&
      active instanceof HTMLElement &&
      (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
    const target = positions.current.get(routeKey) ?? 0;
    let restoring = !window.location.hash && !editing;
    let raf = 0;
    const started = performance.now();
    const record = () => {
      setShowScrollTop(window.scrollY > 400);
      if (!restoring) positions.current.set(routeKey, window.scrollY);
    };
    const surrender = () => {
      restoring = false;
      cancelAnimationFrame(raf);
      record();
    };
    const restore = () => {
      if (!restoring) return;
      window.scrollTo({ top: target, behavior: "instant" });
      // A lazy route can briefly reach the offset, then shrink when its
      // placeholder is replaced. Keep a bounded settling window instead of
      // saving that temporary clamped offset as the reader's position.
      if (target === 0 || performance.now() - started > 1500) {
        restoring = false;
        record();
      } else {
        raf = requestAnimationFrame(restore);
      }
    };

    if (!samePage) document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("wheel", surrender, { passive: true });
    window.addEventListener("touchstart", surrender, { passive: true });
    window.addEventListener("keydown", surrender);
    window.addEventListener("pointerdown", surrender, { passive: true });
    if (restoring) restore();
    else record(); // Leave evidence fragments to their native anchor handling.

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", record);
      window.removeEventListener("wheel", surrender);
      window.removeEventListener("touchstart", surrender);
      window.removeEventListener("keydown", surrender);
      window.removeEventListener("pointerdown", surrender);
    };
  }, [routeKey]);

  return showScrollTop;
}
