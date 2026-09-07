/**
 * Browser-side privacy-preserving analytics.
 *
 * Allocates an ephemeral session token in sessionStorage (cleared when the tab
 * closes) so the server can count distinct sessions without a persistent
 * identifier. Page views and a deliberately tiny allow-list of product events
 * are sent to the self-hosted analytics endpoint. No cookies, fingerprinting,
 * raw IP persistence or third-party scripts.
 */

const SESSION_KEY = "thedesk:session";

export type EngagementEvent =
  | "ask_query"
  | "ask_share"
  | "market_watch"
  | "market_compare"
  | "market_compare_share"
  | "comparison_watch"
  | "comparison_refresh"
  | "comparison_baseline_reset"
  | "signal_watch"
  | "signal_share"
  | "story_share"
  | "take_share"
  | "brief_reshare";

function sessionId(): string | null {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      // 24 hex chars from crypto.getRandomValues. Short enough to fit in the
      // schema's 64-char column, long enough that collisions are negligible.
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
  const nav = navigator as Navigator & { doNotTrack?: string | null };
  return (
    nav.doNotTrack === "1" ||
    (typeof window !== "undefined" &&
      (window as Window & { doNotTrack?: string | null }).doNotTrack === "1")
  );
}

function send(path: "/api/analytics/pageview" | "/api/analytics/event", body: object): void {
  const payload = JSON.stringify(body);
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(path, blob);
      return;
    }
  } catch {
    // Older browsers can reject Beacon payloads. Fall through to fetch.
  }
  void fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: payload,
  }).catch(() => {
    // Analytics must never leak into product behaviour.
  });
}

let lastPath: string | null = null;

/** Fire a page-view beacon for the current location. Debounced against the
 * previous fired path so duplicate-route renders don't double-count. */
export function trackPageView(): void {
  if (typeof window === "undefined" || dntEnabled()) return;
  const id = sessionId();
  if (!id) return;

  const path = window.location.pathname || "/";
  if (path === lastPath) return;
  lastPath = path;

  send("/api/analytics/pageview", {
    path,
    referrer: document.referrer || "",
    sessionId: id,
  });
}

/**
 * Record a high-value product action. The event name is compile-time bounded
 * and server allow-listed; no question text, market name, metric value or other
 * user-entered content is sent. `surface` is an optional fixed product label,
 * not arbitrary metadata.
 */
export function trackEvent(event: EngagementEvent, surface?: string): void {
  if (typeof window === "undefined" || dntEnabled()) return;
  const id = sessionId();
  if (!id) return;
  send("/api/analytics/event", {
    event,
    surface: surface?.slice(0, 32),
    path: window.location.pathname || "/",
    sessionId: id,
  });
}
