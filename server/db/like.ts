/**
 * Escape user input before splicing it into a SQL LIKE pattern. The
 * parameterised query already prevents injection; this prevents `%` and `_`
 * (and a trailing backslash) in a public search string from acting as
 * wildcards — a bare "%" would force a full scan of the unindexed
 * `editions.fullText` column on every request.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
