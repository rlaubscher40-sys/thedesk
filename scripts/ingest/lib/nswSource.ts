import type { Source } from "../sources";
import type { FetchedItem } from "./rss";
import { cleanHeadline } from "../../../shared/headline";
import { plainText } from "./text";

/** Public NSW ministerial search. Index dates, modified times and snippets
 * cannot substitute for reading the original release and its publication date. */
export function parseNswSource(json: string, source: Source): FetchedItem[] {
  if (new URL(source.url).origin !== "https://www.nsw.gov.au") return [];
  const data = JSON.parse(json);
  if (data?.timed_out || !Array.isArray(data?.hits?.hits)) return [];
  const items = new Map<string, FetchedItem>();
  for (const hit of data.hits.hits.slice(0, 100)) {
    const row = hit?._source;
    if (row?.status?.[0] !== true || row?.subtype?.[0] !== "ministerialmediarelease") continue;
    if (typeof row?.url?.[0] !== "string" || typeof row?.title?.[0] !== "string") continue;
    try {
      const url = new URL(row.url[0], source.url);
      const title = cleanHeadline(plainText(row.title[0], 480));
      if (
        url.origin !== "https://www.nsw.gov.au" ||
        url.username ||
        url.password ||
        !/^\/ministerial-releases\/[^/]+$/.test(url.pathname) ||
        title.length < 18
      )
        continue;
      url.search = "";
      url.hash = "";
      items.set(url.href, {
        title,
        url: url.href,
        summary: "",
        source: source.name,
        category: source.category,
        channel: source.channel,
        imageUrl: null,
        isoDate: null,
        discovery: "publisher-index",
      });
    } catch {
      /* Unusable link; never widen to arbitrary search results. */
    }
  }
  return [...items.values()].slice(0, source.maxItems ?? 12);
}
