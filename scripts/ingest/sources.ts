/**
 * RSS source list for the daily ingest.
 *
 * Every source is tagged with two axes:
 *   - `category` — the story's topic (MACRO, PROPERTY, …), used for card accents.
 *   - `channel`  — the Discover content lane it feeds (the Today-page tabs).
 *
 * Channels (see shared/const.ts FEED_CHANNELS):
 *   - AU       — Australia's Top Stories (flagship). Australian sources PLUS
 *                the partner-relevant global macro/markets lens. Enriched.
 *   - PROPERTY — Australian property specifically. Enriched.
 *   - BUSINESS — global business/markets coverage. Coverage-only.
 *   - TECH     — global tech & science coverage. Coverage-only.
 *   - GLOBAL   — world top stories. Coverage-only.
 *
 * Only AU + PROPERTY receive the LLM editorial enrichment (partner angles,
 * Say This, Why it matters, Counterpoint) — the rest are coverage lanes that
 * give readers breadth without the commercial overlay. The gate lives in
 * shared/const.ts (ENRICHED_CHANNELS) and is applied server-side.
 *
 * Three tiers of sources, ordered by signal-to-noise:
 *   1. Official / regulators — RBA, Treasury. First-class signal.
 *   2. Australian newsrooms with reliable RSS — ABC, Guardian, etc.
 *   3. Google News topic queries — laser-targeted to the beat. Each query
 *      pulls relevant items from across publishers without us maintaining a
 *      long source list.
 *
 * Categories must match the union in shared/schemas.ts. The category set here
 * is the default; the LLM enrichment downstream can refine.
 */
import type { FeedChannel } from "../../shared/const";

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
  /** The Discover content lane this source feeds. */
  channel: FeedChannel;
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

/**
 * Global Google News query — same shape, US/global geo. Used for the
 * international tier so partner conversations don't only have an
 * Australian lens.
 */
function googleNewsGlobal(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

export const SOURCES: Source[] = [
  // ══ AU FLAGSHIP ═══════════════════════════════════════════════════════════
  // ── Tier 1: Official / regulators ────────────────────────────────────────
  {
    name: "RBA",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
    category: "MACRO",
    channel: "AU",
    maxItems: 4,
  },
  {
    name: "RBA Speeches",
    url: "https://www.rba.gov.au/rss/rss-cb-speeches.xml",
    category: "MACRO",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "Treasury",
    url: "https://treasury.gov.au/rss.xml",
    category: "POLICY",
    channel: "AU",
    maxItems: 3,
  },

  // ── Tier 2: Australian newsrooms with reliable RSS ───────────────────────
  {
    name: "ABC News Business",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
    category: "MARKETS",
    channel: "AU",
    maxItems: 4,
  },
  {
    name: "Guardian AU Business",
    url: "https://www.theguardian.com/au/business/rss",
    category: "MARKETS",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "Guardian AU Politics",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
    category: "POLICY",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "Guardian AU Economy",
    url: "https://www.theguardian.com/australia-news/australian-economy/rss",
    category: "ECONOMICS",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "The Conversation · Business",
    url: "https://theconversation.com/au/business/articles.atom",
    category: "MARKETS",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "The Conversation · Economy",
    url: "https://theconversation.com/au/topics/australian-economy-9/articles.atom",
    category: "ECONOMICS",
    channel: "AU",
    maxItems: 2,
  },

  // ── Tier 3: Google News topic queries (laser-targeted, AU beat) ──────────
  {
    name: "RBA & Cash Rate",
    url: googleNews('"Reserve Bank of Australia" OR "RBA" rates'),
    category: "MACRO",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "APRA & Lending",
    url: googleNews('APRA Australia lending OR serviceability OR banks'),
    category: "POLICY",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "Mortgage Brokers & Lending",
    url: googleNews(
      'Australia "mortgage broker" OR "broker channel" OR "fixed rate" mortgage'
    ),
    category: "MARKETS",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "ASX & Markets",
    url: googleNews('ASX 200 OR "Australian shares" OR "AUD USD"'),
    category: "MARKETS",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "Inflation & Economy",
    url: googleNews(
      'Australia inflation OR CPI OR "Reserve Bank" GDP OR unemployment'
    ),
    category: "ECONOMICS",
    channel: "AU",
    maxItems: 2,
  },

  // ── Partner-relevant global lens (stays in the AU flagship per brief) ────
  // Globally-set rates, US property and world markets move regardless of
  // border but are core to partner conversations, so they're enriched here
  // rather than dropped into the coverage lanes.
  {
    name: "Global · Central banks",
    url: googleNewsGlobal('Federal Reserve OR ECB OR "Bank of England" OR "Bank of Japan" rates'),
    category: "MACRO",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "Global · Markets & rates",
    url: googleNewsGlobal('"10-year yield" OR "S&P 500" OR "dollar index"'),
    category: "MARKETS",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "Global · US property & mortgage",
    url: googleNewsGlobal('US "housing market" OR "mortgage rates" OR "home prices"'),
    category: "PROPERTY",
    channel: "AU",
    maxItems: 2,
  },

  // ══ PROPERTY (Australian property — enriched) ═════════════════════════════
  // Lead with a direct publisher feed (real article summaries → a proper dek on
  // the card), then targeted Google News queries for the on-the-beat investor
  // angles GNews surfaces well but only ever returns a headline-echo summary for.
  {
    name: "Guardian AU Housing",
    url: "https://www.theguardian.com/australia-news/housing/rss",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 4,
  },
  {
    name: "Australian Property Market",
    url: googleNews(
      'Australia property prices OR "housing market" OR "house prices" -realestate.com.au/buy'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 4,
  },
  {
    name: "Sydney & Melbourne Auctions",
    url: googleNews(
      '("auction clearance" OR "auction results") Sydney OR Melbourne'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "Buyer's Agents & Investors",
    url: googleNews(
      '"buyer\'s agent" Australia OR "property investor" Australia'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "AU Rental & Construction",
    url: googleNews(
      'Australia "rental market" OR "housing supply" OR "dwelling approvals" OR construction'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },

  // ══ BUSINESS (global business/markets — coverage only) ════════════════════
  // Direct publisher feeds, not Google News queries: GNews descriptions are
  // just the headline echoed, which leaves coverage cards with no subline.
  // These mastheads ship a real article summary in each item.
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    category: "MARKETS",
    channel: "BUSINESS",
    maxItems: 4,
  },
  {
    name: "CNBC · Top News",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    category: "MARKETS",
    channel: "BUSINESS",
    maxItems: 3,
  },
  {
    name: "Guardian · Business",
    url: "https://www.theguardian.com/business/rss",
    category: "MARKETS",
    channel: "BUSINESS",
    maxItems: 3,
  },
  {
    name: "MarketWatch · Top Stories",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    category: "MARKETS",
    channel: "BUSINESS",
    maxItems: 2,
  },

  // ══ TECH & SCIENCE (global — coverage only) ═══════════════════════════════
  {
    name: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    category: "TECH",
    channel: "TECH",
    maxItems: 3,
  },
  {
    name: "BBC Science & Environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    category: "SCIENCE",
    channel: "TECH",
    maxItems: 3,
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "TECH",
    channel: "TECH",
    maxItems: 3,
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: "TECH",
    channel: "TECH",
    maxItems: 3,
  },
  {
    name: "ScienceDaily · Top",
    url: "https://www.sciencedaily.com/rss/top/science.xml",
    category: "SCIENCE",
    channel: "TECH",
    maxItems: 2,
  },

  // ══ GLOBAL TOP STORIES (world news — coverage only) ═══════════════════════
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "OTHER",
    channel: "GLOBAL",
    maxItems: 4,
  },
  {
    name: "Guardian · World",
    url: "https://www.theguardian.com/world/rss",
    category: "OTHER",
    channel: "GLOBAL",
    maxItems: 3,
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    category: "GEOPOLITICS",
    channel: "GLOBAL",
    maxItems: 3,
  },
  {
    name: "NPR · World",
    url: "https://feeds.npr.org/1004/rss.xml",
    category: "OTHER",
    channel: "GLOBAL",
    maxItems: 3,
  },

  // ── AU trending signal ───────────────────────────────────────────────────
  {
    name: "Google · Top headlines AU",
    url: "https://news.google.com/rss?hl=en-AU&gl=AU&ceid=AU:en",
    category: "OTHER",
    channel: "AU",
    maxItems: 2,
  },
];

/**
 * Per-channel item targets after dedup + clustering. The flagship gets the
 * lion's share; the coverage lanes are capped lower so a quiet AU day can't be
 * buried under world headlines, and a busy world day can't starve the
 * flagship. Tuned so a normal run ships ~45 stories across five tabs.
 */
export const CHANNEL_TARGETS: Record<FeedChannel, number> = {
  AU: 16,
  PROPERTY: 6,
  BUSINESS: 8,
  TECH: 8,
  GLOBAL: 8,
};

/**
 * Minimum AU-flagship stories for a run to ship. The flagship is the product;
 * if it comes up thin the run aborts rather than publishing a hollow Today
 * page padded out with coverage-lane filler.
 */
export const DAILY_ITEM_MIN = 8;
