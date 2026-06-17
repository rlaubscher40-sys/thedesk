/**
 * Deterministic hero-library fallback for a feed card whose story has no
 * usable og:image (none scraped, or the scraped URL failed to load in the
 * browser — news og:images are frequently hotlink-protected and 403 on a
 * cross-origin <img>).
 *
 * Backed by a single `heroLibrary.activePool` query that react-query shares
 * across every card on the page, so a 20-card grid still issues one request.
 * The pick is `seed % pool.length` (seed = feed item id) so a given story
 * always lands on the same cover and never flickers between renders.
 *
 * Returns null when disabled or the library is empty — the caller then renders
 * its own final fallback (a category-tinted gradient), so a missing photo is
 * never an empty plate or a broken-image icon.
 */
import { trpc } from "./trpc";

export function useHeroFallback(seed: number, enabled: boolean): string | null {
  const pool = trpc.heroLibrary.activePool.useQuery(undefined, {
    enabled,
    staleTime: 60 * 60 * 1000,
  });
  if (!enabled) return null;
  const list = pool.data ?? [];
  if (list.length === 0) return null;
  const picked = list[Math.abs(seed) % list.length];
  return picked?.url ?? null;
}
