/**
 * "Lite mode" — the cheapest paint path, for devices that either ask for it
 * (prefers-reduced-motion) or have proven they can't keep the full app alive
 * (a recorded crash loop, see crashLoopDetector). In lite mode the app drops
 * the per-navigation Framer Motion transition, the per-item stagger animation,
 * the continuous ambient-orb background, and all backdrop-filter blur — the
 * GPU/memory-heavy effects that push a low-memory iOS WebKit tab over the edge.
 *
 * The signal is sticky (localStorage) so it survives the reload that follows a
 * crash, and additive with the OS reduced-motion preference. Toggling the
 * `lite` class on <html> lets index.css do the visual half (see the html.lite
 * rules there); this module owns the JS half (skipping the motion components).
 */
const LITE_KEY = "thedesk:lite-mode";
let enabledThisPage = false;

/** OS-level "I want less motion" preference. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** True when the app should render its cheapest, least animated form. */
export function isLiteMode(): boolean {
  if (enabledThisPage) return true;
  if (prefersReducedMotion()) return true;
  // Use the cheaper paint path from the first visit on phones and tablets,
  // including iPads reporting a desktop viewport. Do not wait for a crash.
  if (typeof window !== "undefined" && typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches) return true;
  try {
    return localStorage.getItem(LITE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the lite flag (e.g. after a crash loop) and apply the class now. */
export function enableLiteMode(): void {
  enabledThisPage = true;
  try {
    localStorage.setItem(LITE_KEY, "1");
  } catch {
    /* storage unavailable — the class still applies for this session */
  }
  applyLiteClass();
}

/** Mirror the current lite state onto <html> so the CSS half can take effect.
 *  Call once, early, before first paint. */
export function applyLiteClass(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("lite", isLiteMode());
}
