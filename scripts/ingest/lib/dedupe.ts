import type { FetchedItem } from "./rss";

/** Remove only known tracking keys. Query IDs and case-sensitive paths can
 * identify different reporting, so stripping or lowercasing them loses evidence. */
export function articleIdentity(item: Pick<FetchedItem, "url" | "title">): string {
  if (item.url) {
    try {
      const url = new URL(item.url);
      if (["http:", "https:"].includes(url.protocol)) {
        url.hash = "";
        for (const key of [...url.searchParams.keys()]) {
          if (/^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key))
            url.searchParams.delete(key);
        }
        url.searchParams.sort();
        return `url:${url.toString()}`;
      }
    } catch {
      /* No usable article URL: fall back to the complete headline. */
    }
  }
  return `title:${item.title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()}`;
}

export function dedupeArticles(items: FetchedItem[]): FetchedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = articleIdentity(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
