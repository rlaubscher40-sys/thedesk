/**
 * Browser-side privacy-preserving analytics.
 *
 * Allocates an ephemeral session token in sessionStorage (cleared when the tab
 * closes) so the server can count distinct sessions without a persistent
 * identifier. Page views and a deliberately tiny allow-list of product events
 * are sent to the self-hosted analytics endpoint. No cookies, fingerprinting,
 * raw IP persistence or third-party scripts.
 */

import { analyticsPath } from "@shared/analyticsPath";
import { getArrival } from "@/lib/attribution";
import { socialCampaign } from "@shared/socialCampaign";

const SESSION_KEY = "thedesk:session";

export type EngagementEvent =
  | "social_open"
  | "ask_query"
  | "ask_share"
  | "market_watch"
  | "market_discover"
  | "market_file_ask"
  | "market_file_compare"
  | "market_file_source"
  | "market_file_share"
  | "market_file_export"
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

  // Debounce the actual route in memory, then redact before transmission.
  // Otherwise Perth → Sydney looks like a duplicate /markets/:market view.
  const route = window.location.pathname || "/";
  if (route === lastPath) return;
  const isLanding = lastPath === null;
  lastPath = route;

  send("/api/analytics/pageview", {
    path: analyticsPath(route),
    referrer: document.referrer || "",
    // The path deliberately drops the query string (it can carry identifiers),
    // but that also discarded the campaign tag on an inbound link. Instagram's
    // in-app browser frequently sends no Referer, so without the tag its
    // traffic is indistinguishable from direct. Only the arrival's campaign
    // slug goes — already whitelisted and slugged in lib/attribution — never
    // the raw query.
    campaign: getArrival()?.source,
    socialCampaign: socialCampaign(getArrival()),
    isLanding,
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
    path: analyticsPath(window.location.pathname),
    socialCampaign: socialCampaign(getArrival()),
    sessionId: id,
  });
}
