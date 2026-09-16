import { useEffect, useState, type CSSProperties } from "react";

/** Keep opt-in form dialogs within the visual viewport when a keyboard opens.
 * Do not counteract pinch zoom. Browsers without this API retain the CSS dvh
 * fallback, and listeners exist only while the enabled component is mounted. */
export function useDialogViewport(enabled: boolean): CSSProperties {
  const [viewport, setViewport] = useState<{ height: number; offsetTop: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const view = window.visualViewport;
    if (!view) return;
    const update = () => {
      if (view.scale !== 1 || !Number.isFinite(view.height) || view.height <= 0) return;
      setViewport({ height: view.height, offsetTop: Math.max(0, view.offsetTop) });
    };
    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);
    return () => {
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
    };
  }, [enabled]);
  return enabled && viewport
    ? {
        top: viewport.offsetTop + viewport.height / 2,
        maxHeight: `calc(${viewport.height}px - 2rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
      }
    : {};
}
