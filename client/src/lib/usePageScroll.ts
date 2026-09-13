import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** The document is the scroll container on both desktop and mobile. */
export function usePageScroll(routeKey: string) {
  const positions = useRef(new Map<string, number>());
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const target = positions.current.get(routeKey) ?? 0;
    let restoring = !window.location.hash;
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
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key))
        surrender();
    };
    const restore = () => {
      window.scrollTo({ top: target, behavior: "instant" });
      if (Math.abs(window.scrollY - target) <= 2 || performance.now() - started > 1500) {
        restoring = false;
        record();
      } else {
        raf = requestAnimationFrame(restore);
      }
    };

    document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("wheel", surrender, { passive: true });
    window.addEventListener("touchstart", surrender, { passive: true });
    window.addEventListener("keydown", onKey);
    if (restoring) restore();
    else record(); // Leave evidence fragments to their native anchor handling.

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", record);
      window.removeEventListener("wheel", surrender);
      window.removeEventListener("touchstart", surrender);
      window.removeEventListener("keydown", onKey);
    };
  }, [routeKey]);

  return showScrollTop;
}
