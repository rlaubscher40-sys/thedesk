import { sourceRightsHold } from "../../../shared/sourceRights";
/** Explicit operational pause after repeated production denials. Re-enable only
 * after a reviewed publisher-approved route works. Covers rediscovered links. */
export function publisherAccessPause(url: string | null): string | null {
  const rights = sourceRightsHold(url ?? "");
  if (rights) return rights;
  try {
    const host = new URL(url ?? "").hostname.toLowerCase();
    if (host === "professionalplanner.com.au" || host.endsWith(".professionalplanner.com.au"))
      return "article-source-paused";
  } catch {
    /* Invalid URLs are handled by the outbound URL guard. */
  }
  return null;
}

/** Bounded process-local pauses, separate from discovery-feed health.
 * A denied article does not prove every page on that publisher is denied.
 * Only rate limits pause an entire origin. No cached text or automatic retries. */
export function createArticleAccess({
  now = Date.now,
  maxEntries = 512,
}: {
  now?: () => number;
  maxEntries?: number;
} = {}) {
  const pauses = new Map<string, { since: number; until: number; status: number }>();
  const keys = (url: string) => {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      return { article: `url:${parsed.href}`, origin: `origin:${parsed.origin}` };
    } catch {
      return null;
    }
  };
  return {
    check(url: string): string | null {
      const paused = publisherAccessPause(url);
      if (paused) return paused;
      const key = keys(url);
      if (!key) return null;
      for (const k of [key.origin, key.article]) {
        const pause = pauses.get(k);
        if (!pause) continue;
        if (now() < pause.since || now() >= pause.until) {
          pauses.delete(k);
          continue;
        }
        return `article-cooldown-http-${pause.status}`;
      }
      return null;
    },
    record(url: string, status: number, retryAfter: string | null) {
      if (![401, 403, 429].includes(status) || maxEntries <= 0) return;
      const key = keys(url);
      if (!key) return;
      const since = now();
      const requested =
        retryAfter && /^\d+$/.test(retryAfter.trim())
          ? Number(retryAfter) * 1000
          : retryAfter
            ? Date.parse(retryAfter) - since
            : 0;
      const delay = Math.max(
        status === 429 ? 3600_000 : 6 * 3600_000,
        Number.isFinite(requested) ? requested : 0
      );
      const k = status === 429 ? key.origin : key.article;
      pauses.delete(k);
      while (pauses.size >= maxEntries) pauses.delete(pauses.keys().next().value!);
      pauses.set(k, { since, until: Math.min(8.64e15, since + delay), status });
    },
  };
}
