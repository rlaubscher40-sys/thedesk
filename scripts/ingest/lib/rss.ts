/**
 * Thin wrapper around rss-parser. Returns normalised items plus the source's
 * fixed category, with a per-fetch timeout so one slow site can't stall
 * the whole run.
 */
import Parser from "rss-parser";
import { DEFAULT_SITE_URL } from "../../../shared/const";
import { cleanHeadline } from "../../../shared/headline";
import type { Source } from "../sources";
import { plainText } from "./text";

const SITE_URL = process.env.SITE_URL ?? DEFAULT_SITE_URL;

const parser = new Parser({
  timeout: 8_000,
  headers: { "User-Agent": `TheDesk/1.0 (+${SITE_URL})` },
});

export type FetchedItem = {
  source: string;
  category: string;
  /** The Discover content lane this item belongs to, carried from its
   *  source. Rides through clustering/ranking into the ingest payload. */
  channel: string;
  title: string;
  summary: string;
  url: string | null;
  isoDate: string | null;
  /** How many distinct sources reported this story (set by the clustering
   *  pass; absent/1 means a single outlet). */
  corroborationCount?: number;
  /** Distinct source names that corroborated this story, when more than one. */
  corroboratingSources?: string[] | null;
};

export async function fetchSource(src: Source): Promise<FetchedItem[]> {
  try {
    const feed = await parser.parseURL(src.url);
    const items = (feed.items ?? []).slice(0, src.maxItems ?? 5);
    return items
      .map((it): FetchedItem | null => {
        // Strip the " - Publisher" suffix Google News appends; we show the
        // source separately, so the suffix is pure noise (and pollutes the
        // clustering/threading token sets).
        const title = cleanHeadline(plainText(it.title, 480));
        const summary = plainText(it.contentSnippet || it.content || it.summary || "", 480);
        if (!title || !summary) return null;
        return {
          source: src.name,
          category: src.category,
          channel: src.channel,
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
