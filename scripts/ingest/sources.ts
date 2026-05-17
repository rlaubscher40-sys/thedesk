/**
 * RSS source list for the daily ingest.
 *
 * Three tiers of sources, ordered by signal-to-noise:
 *
 *   1. Official / regulators — RBA, Treasury. First-class signal.
 *   2. Australian newsrooms with reliable RSS — ABC, Guardian, etc.
 *   3. Google News topic queries — laser-targeted to the partner-channel
 *      beat. Each query pulls relevant items from across publishers
 *      without us having to maintain a long source list. The redirect
 *      url is uglier than a direct masthead URL but the relevance is
 *      consistently better than scraping a generic "business" feed.
 *
 * Categories must match the union in shared/schemas.ts. The category set
 * here is the default; the LLM enrichment downstream can refine.
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
  name: string;
  url: string;
  category: SourceCategory;
  maxItems?: number;
};

/**
 * Google News RSS — laser-targeted topic queries. Each returns Australian
 * news matching the search, scored by Google's relevance ranking. The
 * link is a Google redirect (uglier than direct masthead URLs) but the
 * relevance is much higher than scraping a generic business feed.
 *
 * Format: q=<query>&hl=en-AU&gl=AU&ceid=AU:en
 */
function googleNews(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "en-AU",
    gl: "AU",
    ceid: "AU:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

export const SOURCES: Source[] = [
  // ── Tier 1: Official / regulators ────────────────────────────────────────
  {
    name: "RBA",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
    category: "MACRO",
    maxItems: 4,
  },
  {
    name: "RBA Speeches",
    url: "https://www.rba.gov.au/rss/rss-cb-speeches.xml",
    category: "MACRO",
    maxItems: 3,
  },
  {
    name: "Treasury",
    url: "https://treasury.gov.au/rss.xml",
    category: "POLICY",
    maxItems: 3,
  },

  // ── Tier 2: Australian newsrooms with reliable RSS ───────────────────────
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
  {
    name: "Guardian AU Politics",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
    category: "POLICY",
    maxItems: 2,
  },
  {
    name: "The Conversation · Business",
    url: "https://theconversation.com/au/business/articles.atom",
    category: "MARKETS",
    maxItems: 2,
  },
  {
    name: "The Conversation · Economy",
    url: "https://theconversation.com/au/topics/australian-economy-9/articles.atom",
    category: "ECONOMICS",
    maxItems: 2,
  },

  // ── Tier 3: Google News topic queries (laser-targeted) ──────────────────
  {
    name: "RBA & Cash Rate",
    url: googleNews('"Reserve Bank of Australia" OR "RBA" rates'),
    category: "MACRO",
    maxItems: 3,
  },
  {
    name: "APRA & Lending",
    url: googleNews('APRA Australia lending OR serviceability OR banks'),
    category: "POLICY",
    maxItems: 3,
  },
  {
    name: "Australian Property Market",
    url: googleNews(
      'Australia property prices OR "housing market" OR "house prices" -realestate.com.au/buy'
    ),
    category: "PROPERTY",
    maxItems: 4,
  },
  {
    name: "Sydney & Melbourne Auctions",
    url: googleNews(
      '("auction clearance" OR "auction results") Sydney OR Melbourne'
    ),
    category: "PROPERTY",
    maxItems: 2,
  },
  {
    name: "Mortgage Brokers & Lending",
    url: googleNews(
      'Australia "mortgage broker" OR "broker channel" OR "fixed rate" mortgage'
    ),
    category: "MARKETS",
    maxItems: 3,
  },
  {
    name: "ASX & Markets",
    url: googleNews('ASX 200 OR "Australian shares" OR "AUD USD"'),
    category: "MARKETS",
    maxItems: 2,
  },
  {
    name: "Inflation & Economy",
    url: googleNews(
      'Australia inflation OR CPI OR "Reserve Bank" GDP OR unemployment'
    ),
    category: "ECONOMICS",
    maxItems: 2,
  },
  {
    name: "Buyer's Agents & Investors",
    url: googleNews(
      '"buyer\'s agent" Australia OR "property investor" Australia'
    ),
    category: "PROPERTY",
    maxItems: 2,
  },

  // ── Tier 4: Trending signals ─────────────────────────────────────────────
  // Reddit RSS endpoints used to be free for unauthenticated bots — now
  // their cloudflare layer returns 403 on Actions IPs without an OAuth
  // token. Each failed fetch was blowing the full 8s rss-parser timeout
  // and contributing to job timeouts, so they've been removed. Wire
  // back in via a Reddit OAuth app + reddit-api package when retail
  // sentiment becomes a real editorial input.
  {
    name: "Google · Top headlines AU",
    url: "https://news.google.com/rss?hl=en-AU&gl=AU&ceid=AU:en",
    category: "OTHER",
    maxItems: 3,
  },
];

/** How many items to ship per daily run after dedup. */
export const DAILY_ITEM_TARGET = 20;
export const DAILY_ITEM_MIN = 8;
