/** Private operational logs need stage/reason evidence, not article bodies,
 * model output, credentials, query parameters or user notes. */
export function editorialDecisionLog(row: {
  url?: string | null;
  sourceUrl?: string | null;
  reason: string;
  selected?: boolean;
  readAttempted?: boolean;
}) {
  let url: string | null = null;
  try {
    const parsed = new URL(row.url ?? row.sourceUrl ?? "");
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password)
      url = `${parsed.origin}${parsed.pathname}`.slice(0, 2048);
  } catch {
    /* Invalid URL is not logged verbatim. */
  }
  return {
    url,
    reason: row.reason.slice(0, 128),
    ...(row.selected !== undefined ? { selected: row.selected } : {}),
    ...(row.readAttempted !== undefined ? { readAttempted: row.readAttempted } : {}),
  };
}
