import type { Source } from "../sources";
import type { FetchedItem } from "./rss";
import { cleanHeadline } from "../../../shared/headline";
import { plainText } from "./text";

export const VICTORIA_SEARCH_URL =
  "https://www.premier.vic.gov.au/api/tide/elasticsearch/content-premier-vic-gov-au__production__sapi_node/_search";
// Anonymous, read-only POST search used by the public media centre. The
// immutable query shares a cache entry by endpoint. Never send credentials.
export const VICTORIA_SEARCH_BODY = JSON.stringify({
  size: 12,
  sort: [{ field_news_date: "desc" }],
  _source: ["url", "title", "type", "status", "field_node_site"],
  query: {
    bool: {
      filter: [
        { terms: { type: ["news"] } },
        { terms: { field_node_site: [4] } },
        { terms: { status: [true] } },
      ],
      must: [{ match: { title: "housing homes rent rental renters planning" } }],
    },
  },
});

export function parseVictoriaSource(json: string, source: Source): FetchedItem[] {
  if (source.url !== VICTORIA_SEARCH_URL) return [];
  const data = JSON.parse(json);
  if (data?.timed_out || data?._shards?.failed > 0 || !Array.isArray(data?.hits?.hits))
    throw new Error("Incomplete Victorian media search response");
  const items = new Map<string, FetchedItem>();
  for (const hit of data.hits.hits.slice(0, 100)) {
    const row = hit?._source;
    if (
      row?.status?.[0] !== true ||
      row?.type?.[0] !== "news" ||
      !Array.isArray(row?.field_node_site) ||
      !row.field_node_site.includes(4)
    )
      continue;
    if (typeof row?.url?.[0] !== "string" || typeof row?.title?.[0] !== "string") continue;
    // The publisher's index uses an internal site prefix. Only accept this
    // known site and single article slug, then resolve to its public URL.
    if (!/^\/site-4\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(row.url[0])) continue;
    const title = cleanHeadline(plainText(row.title[0], 480));
    if (title.length < 18) continue;
    const url = new URL(
      row.url[0].replace(/^\/site-4/, "").replace(/\/$/, ""),
      "https://www.premier.vic.gov.au"
    ).href;
    items.set(url, {
      title,
      url,
      summary: "",
      source: source.name,
      category: source.category,
      channel: source.channel,
      imageUrl: null,
      isoDate: null,
      discovery: "publisher-index",
    });
  }
  return [...items.values()].slice(0, source.maxItems ?? 12);
}
