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
 *
 * If a source's URL 404s or stops being valid RSS, the script logs a
 * warning and skips it — one bad feed doesn't sink the run. So leaving
 * speculative URLs in here is fine; they self-disable.
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
  /** Short masthead shown on the card — "RBA", "Reddit / r/AusFinance", etc. */
  name: string;
  /** RSS / Atom URL. */
  url: string;
  /** Default category for items from this source. */
  category: SourceCategory;
  /** Cap items pulled from this source in one run. */
  maxItems?: number;
};

export const SOURCES: Source[] = [
  // ── Regulators & official ────────────────────────────────────────────────
  // First-class signal — these are the institutions that move markets.
  {
    name: "RBA",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
    category: "MACRO",
    maxItems: 3,
  },
  {
    name: "RBA Speeches",
    url: "https://www.rba.gov.au/rss/rss-cb-speeches.xml",
    category: "MACRO",
    maxItems: 2,
  },
  {
    name: "APRA",
    url: "https://www.apra.gov.au/rss/news.xml",
    category: "POLICY",
    maxItems: 3,
  },
  {
    name: "ASIC",
    url: "https://asic.gov.au/about-asic/news-centre/find-a-media-release/?rss=1",
    category: "POLICY",
    maxItems: 2,
  },
  {
    name: "Treasury",
    url: "https://treasury.gov.au/rss.xml",
    category: "POLICY",
    maxItems: 2,
  },
  {
    name: "ABS",
    url: "https://www.abs.gov.au/AUSSTATS/subscriber.nsf/rss/8B5D67BE9F9C5A5BCA257A7700135D52?opendocument",
    category: "ECONOMICS",
    maxItems: 3,
  },

  // ── Property research ───────────────────────────────────────────────────
  {
    name: "CoreLogic AU",
    url: "https://www.corelogic.com.au/news-research/news/feed",
    category: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "PropTrack",
    url: "https://www.proptrack.com.au/feed/",
    category: "PROPERTY",
    maxItems: 2,
  },
  {
    name: "Domain News",
    url: "https://www.domain.com.au/news/feed/",
    category: "PROPERTY",
    maxItems: 3,
  },

  // ── Markets / Business news ─────────────────────────────────────────────
  {
    name: "ABC News Business",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
    category: "MARKETS",
    maxItems: 3,
  },
  {
    name: "Guardian AU Business",
    url: "https://www.theguardian.com/au/business/rss",
    category: "MARKETS",
    maxItems: 2,
  },
  {
    name: "Livewire Markets",
    url: "https://www.livewiremarkets.com/feed",
    category: "MARKETS",
    maxItems: 2,
  },
  {
    name: "MacroBusiness",
    url: "https://www.macrobusiness.com.au/feed/",
    category: "MACRO",
    maxItems: 3,
  },

  // ── Politics / Policy news ──────────────────────────────────────────────
  {
    name: "ABC News Politics",
    url: "https://www.abc.net.au/news/feed/46182/rss.xml",
    category: "POLICY",
    maxItems: 2,
  },
  {
    name: "Guardian AU Politics",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
    category: "POLICY",
    maxItems: 2,
  },

  // ── Tech / AI ───────────────────────────────────────────────────────────
  {
    name: "ABC News Technology",
    url: "https://www.abc.net.au/news/feed/2942460/rss.xml",
    category: "TECH",
    maxItems: 2,
  },

  // ── Global public pulse (Reddit) ────────────────────────────────────────
  // Reddit's per-subreddit RSS is free and unauthenticated. We pull the
  // top posts from the last day — surfaces what the audience is actually
  // talking about, not what gets published in mastheads.
  {
    name: "Reddit / r/AusFinance",
    url: "https://www.reddit.com/r/AusFinance/top/.rss?t=day",
    category: "MARKETS",
    maxItems: 3,
  },
  {
    name: "Reddit / r/AusProperty",
    url: "https://www.reddit.com/r/AusProperty/top/.rss?t=day",
    category: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "Reddit / r/AusEcon",
    url: "https://www.reddit.com/r/AusEcon/top/.rss?t=day",
    category: "ECONOMICS",
    maxItems: 2,
  },
  {
    name: "Reddit / r/fiaustralia",
    url: "https://www.reddit.com/r/fiaustralia/top/.rss?t=day",
    category: "MARKETS",
    maxItems: 2,
  },
];

/** How many items to ship per daily run after dedup. */
export const DAILY_ITEM_TARGET = 18;
export const DAILY_ITEM_MIN = 8;
