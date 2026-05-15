/**
 * Thin wrapper around rss-parser. Returns normalised items plus the source's
 * fixed category, with a per-fetch timeout so one slow site can't stall
 * the whole run.
 */
import Parser from "rss-parser";
import type { Source } from "../sources";
import { plainText } from "./text";

const parser = new Parser({
  timeout: 8_000,
  headers: { "User-Agent": "TheDesk/1.0 (+https://thedeskglobal.manus.space)" },
});

export type FetchedItem = {
  source: string;
  category: string;
  title: string;
  summary: string;
  url: string | null;
  isoDate: string | null;
};

export async function fetchSource(src: Source): Promise<FetchedItem[]> {
  try {
    const feed = await parser.parseURL(src.url);
    const items = (feed.items ?? []).slice(0, src.maxItems ?? 5);
    return items
      .map((it): FetchedItem | null => {
        const title = plainText(it.title, 480);
        const summary = plainText(it.contentSnippet || it.content || it.summary || "", 480);
        if (!title || !summary) return null;
        return {
          source: src.name,
          category: src.category,
          title,
          summary,
          url: it.link ?? null,
          isoDate: it.isoDate ?? it.pubDate ?? null,
        };
      })
      .filter((x): x is FetchedItem => x !== null);
  } catch (err) {
    console.warn(`[rss] ${src.name} failed: ${(err as Error).message}`);
    return [];
  }
}
