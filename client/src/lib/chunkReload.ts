/** Recovery for failed route downloads, including chunks removed by a deploy. */
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import { withDeadline } from "@shared/requestDeadline";

const RELOAD_KEY = "thedesk:chunk-recovery-at:v2";
const RELOAD_COOLDOWN_MS = 5 * 60_000;
const RECOVERY_PARAM = "_desk_reload";

/** A new document URL avoids repeating a failed same-address reload on WebKit. */
function freshPageUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set(RECOVERY_PARAM, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return url.href;
}

/** Remove only our recovery marker, preserving route, filters, fragment and state. */
export function cleanRecoveryUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RECOVERY_PARAM)) return;
    url.searchParams.delete(RECOVERY_PARAM);
    window.history.replaceState(window.history.state, "", url.href);
  } catch { /* URL cleanup must never prevent startup. */ }
}

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /chunkloaderror/i.test(msg) ||
    /loading chunk \d+ failed/i.test(msg)
  );
}

function claimAutomaticReload(): boolean {
  try {
    const now = Date.now();
    const previous = Number(sessionStorage.getItem(RELOAD_KEY));
    if (previous > 0 && now - previous < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
    // Blocked or silently discarded storage cannot guard a cross-page reload.
    // Show the manual retry instead. One shared cooldown covers every route.
    return sessionStorage.getItem(RELOAD_KEY) === String(now);
  } catch {
    return false;
  }
}

/** Manual and automatic recovery share a deadline; neither clears reader data. */
export async function hardReload(): Promise<void> {
  try {
    await withDeadline(() => Promise.allSettled([
      (async () => {
        if (typeof caches === "undefined") return;
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("thedesk-")).map((key) => caches.delete(key)));
      })(),
      (async () => {
        if (!("serviceWorker" in navigator)) return;
        const registrations = await navigator.serviceWorker.getRegistrations();
        const workerUrl = new URL("/sw.js", window.location.href).href;
        await Promise.all(registrations.filter((registration) =>
          [registration.active, registration.waiting, registration.installing]
            .some((worker) => worker?.scriptURL === workerUrl)
        ).map((registration) => registration.unregister()));
      })(),
    ]), 1500);
  } catch { /* A wedged cache must not prevent retrying the page. */ }
  // Replace prevents Back from returning to the broken document. Keep the
  // sessionStorage cooldown so an unavailable network cannot create a loop.
  window.location.replace(freshPageUrl(window.location.href));
}

export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  _key: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      // A request can stall without rejecting when a network drops traffic.
      return await withDeadline(() => factory(), 20_000);
    } catch (err) {
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (isChunkLoadError(err) && online && claimAutomaticReload()) {
        await hardReload();
      }
      // Never leave a permanently pending Suspense promise. If navigation
      // cannot complete, the error boundary still offers a manual retry.
      throw err;
    }
  });
}
