/**
 * Highlight occurrences of a query inside a string, returning React nodes
 * with the matched spans wrapped in <mark>. Case-insensitive, whole-query
 * (not per-word) so it mirrors the server's LIKE match. Safe against regex
 * metacharacters in the query.
 */
import type { ReactNode } from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  // Capture group in the split pattern keeps the delimiters, so the matched
  // substrings land in the resulting array and can be wrapped in place.
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  const lowerQ = q.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lowerQ ? (
      <mark key={i} className="bg-amber-400/25 text-[var(--color-fg)] rounded-[2px] px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
