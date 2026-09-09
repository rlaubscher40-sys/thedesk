/** Bounded LRU with expiry, single-flight loading and invalidation-safe publication. */
import { serialize } from "node:v8";
export class CacheCapacityError extends Error {}
export function createBoundedCache(
  options = { maxEntries: 512, maxBytes: 32 * 1024 * 1024, maxInflight: 32 }
) {
  type Entry = { value: unknown; expiresAt: number; bytes: number };
  const store = new Map<string, Entry>();
  const inflight = new Map<string, Promise<unknown>>();
  let bytes = 0;
  function remove(key: string) {
    const item = store.get(key);
    if (item) {
      bytes -= item.bytes;
      store.delete(key);
    }
  }
  function purge() {
    const now = Date.now();
    for (const [key, item] of store) if (item.expiresAt <= now) remove(key);
  }
  async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    purge();
    const hit = store.get(key);
    if (hit) {
      store.delete(key);
      store.set(key, hit);
      return hit.value as T;
    }
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
    if (inflight.size >= options.maxInflight) throw new CacheCapacityError("Read capacity reached");
    // Promise.resolve gives the map time to register before even a synchronous loader settles.
    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (inflight.get(key) !== promise) return value;
        const size = Buffer.byteLength(key) + serialize(value).byteLength;
        if (size <= options.maxBytes && ttlMs > 0) {
          remove(key);
          while (store.size >= options.maxEntries || bytes + size > options.maxBytes) {
            const oldest = store.keys().next().value;
            if (oldest === undefined) break;
            remove(oldest);
          }
          store.set(key, { value, expiresAt: Date.now() + ttlMs, bytes: size });
          bytes += size;
        }
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key);
      });
    inflight.set(key, promise);
    return promise;
  }
  function invalidate(prefix = "") {
    for (const key of store.keys()) if (key.startsWith(prefix)) remove(key);
    for (const key of inflight.keys()) if (key.startsWith(prefix)) inflight.delete(key);
  }
  return {
    cached,
    invalidate,
    purge,
    stats: () => ({ entries: store.size, bytes, inflight: inflight.size }),
  };
}
const cache = createBoundedCache();
setInterval(cache.purge, 30000).unref();
export const cached = cache.cached,
  invalidate = cache.invalidate;
export function cacheKey(name: string, input?: unknown) {
  return input === undefined ? name : `${name}:${JSON.stringify(input)}`;
}
