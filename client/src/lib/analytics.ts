/**
 * Browser-side page-view tracker. Replaces the Plausible script.
 *
 * Allocates an ephemeral session token in sessionStorage (cleared
 * when the tab closes) so the server can count distinct sessions
 * within a window without persistent identification — no cookies, no
 * fingerprint. Fires a beacon to /api/analytics/pageview on each
 * route change.
 *
 * Skips reporting when:
 *   · sessionStorage isn't available (no-op gracefully).
 *   · The user has DNT enabled in their browser — the server also
 *     enforces this, but bailing early saves a network call.
 */

const SESSION_KEY = "thedesk:session";

function sessionId(): string | null {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      // 24 hex chars from crypto.getRandomValues. Short enough to
      // fit in the schema's 64-char column, long enough that
      // collisions are negligible across a day's traffic.
      const bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      id = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  // navigator.doNotTrack returns "1" on Chrome/Firefox/Edge,
  // window.doNotTrack on older Safari.
  const nav = navigator as Navigator & { doNotTrack?: string | null };
  return (
    nav.doNotTrack === "1" ||
    (typeof window !== "undefined" &&
      (window as Window & { doNotTrack?: string | null }).doNotTrack === "1")
  );
}

let lastPath: string | null = null;

/** Fire a page-view beacon for the current location. Debounced against
 *  the previous fired path so duplicate-route renders don't double-count. */
export function trackPageView(): void {
  if (typeof window === "undefined") return;
  if (dntEnabled()) return;
  const id = sessionId();
  if (!id) return;

  const path = window.location.pathname || "/";
  if (path === lastPath) return;
  lastPath = path;

  const referrer = document.referrer || "";
  const body = JSON.stringify({ path, referrer, sessionId: id });

  // Prefer sendBeacon — fires reliably even when the user is
  // navigating away. Fallback to fetch with keepalive so the
  // tracker still works in environments without Beacon support.
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/pageview", blob);
      return;
    }
  } catch {
    // sendBeacon can throw on some payloads in older browsers; fall
    // through to fetch.
  }
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body,
  }).catch(() => {
    // Best-effort. Tracking never throws into product code.
  });
}
