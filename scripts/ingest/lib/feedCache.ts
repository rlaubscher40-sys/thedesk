/** Short, process-local reuse for overlapping hourly archive / daily briefing
 * reads. No model, disk, database, timer or background-fetch side effects.
 * Expired entries never substitute for a failed fresh request. */
export class FeedCooldownError extends Error {
  constructor(public readonly retryAt: number, public readonly reason: string) {
    super(`${reason}; retry after ${new Date(retryAt).toISOString()}`);
  }
}
export function createFeedCache<T>(
  load: (url: string) => Promise<T>,
  options: {
    now?: () => number;
    ttlMs?: number;
    maxEntries?: number;
    maxBytes?: number;
    failureTtlMs?: (error: unknown) => number;
    failureReason?: (error: unknown) => string;
  } = {},
) {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const maxEntries = options.maxEntries ?? 128;
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  type Result = { value: T; checkedAt: number };
  const cache = new Map<string, Result & { bytes: number }>();
  const pending = new Map<string, Promise<Result>>();
  const failures = new Map<string, { failedAt: number; retryAt: number; reason: string }>();
  let bytes = 0;

  function remove(url: string) {
    const entry = cache.get(url);
    if (entry) bytes -= entry.bytes;
    cache.delete(url);
  }

  return async (url: string): Promise<Result> => {
    const failure = failures.get(url);
    if (failure && now() >= failure.failedAt && now() < failure.retryAt)
      throw new FeedCooldownError(failure.retryAt, failure.reason);
    failures.delete(url);
    for (const [key, entry] of cache) {
      if (now() - entry.checkedAt >= ttlMs || now() < entry.checkedAt)
        remove(key);
    }
    const hit = cache.get(url);
    if (hit) {
      cache.delete(url);
      cache.set(url, hit);
      return { value: hit.value, checkedAt: hit.checkedAt };
    }
    const active = pending.get(url);
    if (active) return active;
    const request = (async () => {
      let value: T;
      try {
        value = await load(url);
      } catch (error) {
        const delay = options.failureTtlMs?.(error) ?? 0;
        if (Number.isFinite(delay) && delay > 0 && maxEntries > 0) {
          while (failures.size >= maxEntries) failures.delete(failures.keys().next().value!);
          failures.set(url, { failedAt: now(), retryAt: Math.min(8.64e15, now() + delay),
            reason: options.failureReason?.(error) ?? "Feed request failed" });
        }
        throw error;
      }
      const result = { value, checkedAt: now() };
      // Parsing failures are rejected by load; do not cache them or serve an
      // older successful response. Oversized feeds work but are not retained.
      const size = Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
      if (size <= maxBytes && maxEntries > 0 && ttlMs > 0) {
        while (
          cache.size &&
          (cache.size >= maxEntries || bytes + size > maxBytes)
        ) {
          remove(cache.keys().next().value!);
        }
        cache.set(url, { ...result, bytes: size });
        bytes += size;
      }
      return result;
    })();
    // Also bound tracking of in-flight requests. The collectors independently
    // limit their concurrency; overflow callers simply bypass coalescing.
    const tracked = pending.size < maxEntries;
    if (tracked) pending.set(url, request);
    try {
      return await request;
    } finally {
      if (tracked) pending.delete(url);
    }
  };
}
