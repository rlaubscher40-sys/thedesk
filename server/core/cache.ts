/**
 * Tiny in-process TTL cache for hot public read queries.
 *
 * The site's content (daily feed, weekly editions) is read by every
 * anonymous visitor but written only by the single admin / scheduler a
 * handful of times a day. Without a cache, thousands of concurrent
 * readers each turn into a TiDB round-trip for identical data. This
 * collapses every read within a TTL window into a single DB hit, with a
 * short window (tens of seconds) bounding how stale a fresh admin edit
 * can look.
 *
 * Single-instance only by design — the cache lives in this process's
 * heap. That's the deployment model The Desk runs on (one Railway
 * instance, scale up not out). If the app ever scales horizontally,
 * swap this for a shared store (Redis) so replicas don't serve
 * divergent snapshots.
 *
 * Results are treated as immutable: callers must not mutate a cached
 * value in place, since the same reference is handed to every concurrent
 * reader within the window.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/**
 * In-flight loaders, keyed identically to `store`. Dedupes a thundering
 * herd: if 500 readers miss the same cold key in the same tick, only the
 * first triggers the DB query and the rest await its promise.
 */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Return the cached value for `key`, or run `loader`, cache its result
 * for `ttlMs`, and return it. Loader rejections are not cached.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise as Promise<T>;
}

/**
 * Drop every entry whose key starts with `prefix` (or the entire cache
 * when no prefix is given). Called from the admin mutations and the
 * scheduled ingest so an edit shows up immediately rather than waiting
 * out the TTL. The TTL remains the safety net if an invalidation point
 * is ever missed.
 */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Stable cache key from a name + structured input. */
export function cacheKey(name: string, input?: unknown): string {
  return input === undefined ? name : `${name}:${JSON.stringify(input)}`;
}
