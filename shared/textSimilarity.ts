/**
 * Dependency-free headline similarity, shared by the ingest clustering pass
 * (same-day "N outlets" corroboration) and the server-side story threading
 * pass (cross-day "continues from" links). Token overlap with stopwords and
 * short words removed; conservative by design so unrelated stories that share
 * a common term are not linked.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "into", "over", "after",
  "amid", "what", "how", "why", "when", "where", "who", "will", "has", "have",
  "are", "was", "were", "but", "not", "you", "your", "its", "their", "they",
  "new", "says", "say", "said", "could", "would", "may", "australia",
  "australian", "australias", "more", "than", "out", "off", "set", "get",
]);

/** Significant lowercase tokens from a headline. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  );
}

export function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = sharedTokenCount(a, b);
  return inter / (a.size + b.size - inter);
}

/** True when two headlines clear both the shared-token floor and the Jaccard
 *  floor, i.e. they are about the same story. */
export function titlesMatch(
  a: Set<string>,
  b: Set<string>,
  minShared: number,
  minJaccard: number
): boolean {
  return sharedTokenCount(a, b) >= minShared && jaccard(a, b) >= minJaccard;
}

export type Candidate<T> = { value: T; tokens: Set<string> };

/**
 * Best matching candidate for a target headline, or null when none clears the
 * thresholds. Ties break on highest Jaccard.
 */
export function bestMatch<T>(
  target: Set<string>,
  candidates: Candidate<T>[],
  opts: { minShared?: number; minJaccard?: number } = {}
): T | null {
  const minShared = opts.minShared ?? 4;
  const minJaccard = opts.minJaccard ?? 0.4;
  let best: { value: T; score: number } | null = null;
  for (const c of candidates) {
    if (sharedTokenCount(target, c.tokens) < minShared) continue;
    const score = jaccard(target, c.tokens);
    if (score < minJaccard) continue;
    if (!best || score > best.score) best = { value: c.value, score };
  }
  return best ? best.value : null;
}
