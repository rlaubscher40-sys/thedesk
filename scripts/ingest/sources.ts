/**
 * RSS source list for the daily ingest. Each entry maps a feed URL to a
 * default category — the script uses this rather than running an LLM
 * classifier (faster, free, deterministic).
 *
 * Editing this list IS the editorial decision about what The Desk reads.
 * Keep it short and trustworthy; a smaller set of good sources beats a long
 * tail of aggregators.
 *
 * Category values must match the union in shared/schemas.ts.
 */

export type SourceCategory =
  | "MACRO"
  | "PROPERTY"
  | "POLICY"
  | "MARKETS"
  | "AI"
  | "TECH"
  | "GEOPOLITICS"
  | "SCIENCE"
  | "ECONOMICS"
  | "OTHER";

export type Source = {
  /** Short masthead shown on the card — "RBA", "ABC News", etc. */
  name: string;
  /** RSS / Atom URL. */
  url: string;
  /** Default category for items from this source. */
  category: SourceCategory;
  /** Cap items pulled from this source in one run. */
  maxItems?: number;
};

export const SOURCES: Source[] = [
  // ── Macro / Rates ────────────────────────────────────────────────────────
  {
    name: "RBA",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
    category: "MACRO",
    maxItems: 3,
  },
  {
    name: "ABS",
    url: "https://www.abs.gov.au/AUSSTATS/subscriber.nsf/rss/8B5D67BE9F9C5A5BCA257A7700135D52?opendocument",
    category: "ECONOMICS",
    maxItems: 3,
  },

  // ── Markets / Business ───────────────────────────────────────────────────
  {
    name: "ABC News Business",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
    category: "MARKETS",
    maxItems: 4,
  },
  {
    name: "Guardian AU Business",
    url: "https://www.theguardian.com/au/business/rss",
    category: "MARKETS",
    maxItems: 3,
  },

  // ── Property ─────────────────────────────────────────────────────────────
  {
    name: "MacroBusiness",
    url: "https://www.macrobusiness.com.au/feed/",
    category: "PROPERTY",
    maxItems: 4,
  },
  {
    name: "Domain News",
    url: "https://www.domain.com.au/news/feed/",
    category: "PROPERTY",
    maxItems: 3,
  },

  // ── Policy / Politics ────────────────────────────────────────────────────
  {
    name: "ABC News Politics",
    url: "https://www.abc.net.au/news/feed/46182/rss.xml",
    category: "POLICY",
    maxItems: 3,
  },
  {
    name: "Guardian AU Politics",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
    category: "POLICY",
    maxItems: 2,
  },

  // ── Tech / AI ────────────────────────────────────────────────────────────
  {
    name: "ABC News Technology",
    url: "https://www.abc.net.au/news/feed/2942460/rss.xml",
    category: "TECH",
    maxItems: 2,
  },
];

/** How many items to ship per daily run after dedup. */
export const DAILY_ITEM_TARGET = 16;
export const DAILY_ITEM_MIN = 8;
