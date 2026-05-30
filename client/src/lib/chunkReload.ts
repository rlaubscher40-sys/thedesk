/**
 * Recovery for stale-deploy chunk failures.
 *
 * Pages are code-split, so each route is its own content-hashed chunk
 * (e.g. `Editions-Be5TBQc0.js`). When the site redeploys, Vite emits
 * freshly hashed filenames and removes the old ones. A browser still
 * running the previous build — an open tab, or a service worker that
 * handed over a stale index.html — then tries to import a chunk that no
 * longer exists and throws "Failed to fetch dynamically imported
 * module". A React state reset can't fix that: the bytes are gone from
 * the server. The only cure is a fresh load so the browser pulls the
 * current index.html and the chunk hashes it references.
 */
import { type ComponentType, type LazyExoticComponent, lazy } from "react";

const RELOAD_FLAG_PREFIX = "thedesk:chunk-reload:";

/** Does this error look like a missing/failed dynamic-import chunk? */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) || // Safari
    /chunkloaderror/i.test(msg) ||
    /loading chunk \d+ failed/i.test(msg)
  );
}

// sessionStorage can throw (private modes, disabled storage). Treat any
// failure as "no flag set" so recovery still proceeds at least once.
function guardGet(key: string): boolean {
  try {
    return sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function guardSet(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

function guardClear(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Drop service-worker caches, then reload. Clearing the caches first
 * means even a still-active *old* service worker (the cache-first one
 * that pinned a stale index.html) is forced to fetch a fresh shell on
 * the reload, rather than re-serving the broken one. Best-effort: cache
 * cleanup must never block the reload.
 */
export async function hardReload(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore — fall through to the reload regardless */
  }
  window.location.reload();
}

/**
 * Drop-in replacement for `lazy(() => import(...))` that self-heals
 * stale-deploy chunk failures. On the first chunk-load failure for a
 * given page (while online) it forces one fresh load; a per-page
 * sessionStorage guard stops a genuinely missing chunk or an offline
 * device from trapping the user in a reload loop — the second failure
 * falls through to the error boundary instead.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string,
): LazyExoticComponent<T> {
  const flagKey = RELOAD_FLAG_PREFIX + key;
  return lazy(async () => {
    try {
      const mod = await factory();
      // Loaded cleanly — clear any guard left over from a prior recovery.
      guardClear(flagKey);
      return mod;
    } catch (err) {
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (isChunkLoadError(err) && online && !guardGet(flagKey)) {
        guardSet(flagKey);
        void hardReload();
        // Keep the Suspense fallback up while the reload happens instead
        // of flashing the error boundary first.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
