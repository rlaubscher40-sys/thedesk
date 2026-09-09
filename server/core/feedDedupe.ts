import { articleIdentity } from "../../scripts/ingest/lib/dedupe";

/** Reuse the archive's conservative URL identity before insertion/enrichment.
 * Keep content query IDs and path case; never infer identity from similar titles.
 * This prefilter covers recent stored URLs and repeats within one submission.
 * The database claim separately protects races between current ingest workers.
 */
export function unseenFeedItems<T extends { sourceUrl?: string | null; title: string }>(
  items: T[],
  recentUrls: ReadonlySet<string>
): T[] {
  const seen = new Set([...recentUrls].map((url) => articleIdentity({ url, title: "" })));
  return items.filter((item) => {
    const key = articleIdentity({ url: item.sourceUrl ?? "", title: item.title });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
