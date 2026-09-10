import type { Source } from "../sources";
import type { FetchedItem } from "./rss";
import { cleanHeadline } from "../../../shared/headline";
import { plainText } from "./text";

export const ASIC_RELEASE_PATH =
  /^\/about-asic\/news-centre\/find-a-media-release\/20\d{2}-releases\/[^/]+\/?$/;

/** ASIC's anonymous newsroom feed. Never treat CMS creation/update clocks or
 * index descriptions as article publication evidence. */
export function parseAsicSource(json: string, source: Source): FetchedItem[] {
  if (source.url !== "https://download.asic.gov.au/asic-nga/data/newsroom/newsroom-mr-latest.json")
    return [];
  const rows: unknown = JSON.parse(json);
  if (!Array.isArray(rows)) throw new Error("Unexpected ASIC newsroom response");
  const items = new Map<string, FetchedItem>();
  for (const row of rows.slice(0, 100)) {
    if (
      row?.metaType !== "media release" ||
      typeof row.url !== "string" ||
      typeof row.name !== "string"
    )
      continue;
    try {
      const url = new URL(row.url, "https://www.asic.gov.au");
      if (
        url.origin !== "https://www.asic.gov.au" ||
        url.username ||
        url.password ||
        !ASIC_RELEASE_PATH.test(url.pathname)
      )
        continue;
      const title = cleanHeadline(plainText(row.name, 480));
      if (title.length < 18) continue;
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/\/$/, "");
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
      /* Ignore malformed links, never widen the allowed publisher. */
    }
  }
  return [...items.values()].slice(0, source.maxItems ?? 12);
}
