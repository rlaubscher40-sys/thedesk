/**
 * Pure relevance ranking + snippet extraction for the site search.
 *
 * SQL ranks the entire matching set before applying a result cap. The pure
 * helpers supply equivalent demo ranking and readable match snippets.
 */
import { sql, type SQLWrapper } from "drizzle-orm";
import { escapeLike } from "./like";

export function sqlMatchScore(query: string, title: SQLWrapper) {
  const literal = query.trim().toLowerCase();
  const escaped = escapeLike(literal);
  return sql<number>`CASE WHEN LOWER(${title}) = ${literal} THEN 4
    WHEN LOWER(${title}) LIKE ${`${escaped}%`} THEN 3
    WHEN LOWER(${title}) LIKE ${`%${escaped}%`} THEN 2 ELSE 1 END`;
}

/** Case-insensitive index of `needle` in `haystack`, or -1. */
function indexOfCI(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

/**
 * Relevance score for a result given the primary (title-like) field and the
 * body. Higher is better:
 *   4  title equals the query (exact hit)
 *   3  title starts with the query (prefix hit)
 *   2  query appears elsewhere in the title
 *   1  query appears only in the body
 *   0  no textual hit (shouldn't happen for a matched row, but safe)
 */
export function scoreMatch(query: string, title: string, body: string): number {
  const q = query.trim();
  if (!q) return 0;
  const inTitle = indexOfCI(title, q);
  if (inTitle === 0) return title.length === q.length ? 4 : 3;
  if (inTitle > 0) return 2;
  if (indexOfCI(body, q) >= 0) return 1;
  return 0;
}

/**
 * Extract a snippet of `body` centred on the first match of `query`, with an
 * ellipsis where text was trimmed. Returns null when the query isn't in the
 * body (the caller falls back to the title/summary it already shows).
 */
export function extractSnippet(query: string, body: string, radius = 90): string | null {
  const q = query.trim();
  if (!q || !body) return null;
  const at = indexOfCI(body, q);
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + q.length + radius);
  let snip = body.slice(start, end).trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip;
}

/**
 * Rank a list of matched rows by relevance, then by the provided tiebreak
 * (usually recency), and attach a snippet to each. Stable within a score.
 */
export function rankResults<T>(
  query: string,
  rows: T[],
  getTitle: (row: T) => string,
  getBody: (row: T) => string
): Array<T & { snippet: string | null }> {
  return rows
    .map((row, i) => ({
      row,
      i,
      score: scoreMatch(query, getTitle(row), getBody(row)),
      snippet: extractSnippet(query, getBody(row)),
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ row, snippet }) => ({ ...row, snippet }));
}
