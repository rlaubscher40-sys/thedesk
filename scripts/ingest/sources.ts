/**
 * RSS source list for the daily ingest.
 *
 * Every source is tagged with two axes:
 *   - `category` — the story's topic (MACRO, PROPERTY, …), used for card accents.
 *   - `channel`  — the Discover content lane it feeds (the Today-page tabs).
 *
 * Channels (see shared/const.ts FEED_CHANNELS):
 *   - AU       — Australia's Top Stories (flagship). Australian reporting, checked story by story. Enriched.
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
import { VICTORIA_SEARCH_URL } from "./lib/victoriaSource";

type SourceCategory =
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
  kind?: "rss" | "index" | "nsw-index" | "asic-index" | "victoria-index";
  articlePath?: string;
  /** Require a publisher-declared article type around index links. */
  articleContainerClass?: string;
  /** Restrict discovery to the publisher's actual headline links. */
  articleLinkClass?: string;
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
  {
    name: "Victoria Housing Releases",
    url: VICTORIA_SEARCH_URL,
    kind: "victoria-index",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 12,
  },
  {
    name: "ASIC Media Releases",
    // Public JSON used by ASIC's newsroom. Dates/snippets here are discovery
    // metadata only; selection requires evidence from the original release.
    url: "https://download.asic.gov.au/asic-nga/data/newsroom/newsroom-mr-latest.json",
    kind: "asic-index",
    category: "POLICY",
    channel: "AU",
    maxItems: 12,
  },
  {
    name: "NSW Housing Releases",
    // Anonymous search endpoint advertised by the ministerial-releases page.
    // Search metadata is discovery only; the release supplies publication evidence.
    url:
      "https://www.nsw.gov.au/api/v1/elasticsearch/prod_content/_search?" +
      new URLSearchParams({
        q: "status:true AND subtype:ministerialmediarelease AND (title:housing OR title:rent* OR title:planning OR title:homes)",
        sort: "display_date:desc",
        size: "30",
        _source: "url,title,subtype,status",
      }).toString(),
    kind: "nsw-index",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 30,
  },
  {
    name: "Queensland Housing Releases",
    url: "https://statements.qld.gov.au/?Search=True&Text=housing",
    kind: "index",
    articlePath: "^/statements/[0-9]+$",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 12,
  },
  {
    name: "Housing Australia",
    url: "https://www.housingaustralia.gov.au/media",
    kind: "index",
    articlePath: "^/media/[^/]+$",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 8,
  },
  {
    name: "AHURI Research News",
    url: "https://www.ahuri.edu.au/insights/latest-news",
    kind: "index",
    articlePath: "^/(?:analysis/news|news)/[^/]+$",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 8,
  },
  {
    name: "SQM Research Releases",
    url: "https://sqmresearch.com.au/media",
    kind: "index",
    articlePath: "^/uploads/[0-9]{2}-[0-9]{2}-[0-9]{2}-[^/]+\\.pdf$",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 6,
  },
  // Audited 2026-09-10: direct discovery; every article still needs original
  // publication evidence, readable reporting, Australian scope and beat fit.
  {
    name: "APRA News",
    url: "https://www.apra.gov.au/news-and-publications",
    kind: "index",
    articlePath: "^/news-and-publications/[^/]+$",
    articleContainerClass: "node--type-news",
    category: "POLICY",
    channel: "AU",
    maxItems: 8,
  },
  {
    name: "Cotality Australia",
    url: "https://www.cotality.com/au/insights",
    kind: "index",
    articlePath: "^/au/insights/articles/[^/]+$",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 8,
  },
  {
    name: "Treasury Ministerial Releases",
    url: "https://ministers.treasury.gov.au/ministers/jim-chalmers-2022/media-releases",
    kind: "index",
    articlePath: "^/ministers/jim-chalmers-2022/media-releases/[^/]+$",
    category: "POLICY",
    channel: "AU",
    maxItems: 6,
  },
  {
    name: "Australian Broker",
    url: "https://www.brokernews.com.au/rss",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 20,
  },
  {
    name: "Professional Planner",
    // RSS denies requests; the public newsroom advertises dated article links.
    url: "https://www.professionalplanner.com.au/",
    kind: "index",
    articlePath: "^/20[0-9]{2}/[0-9]{2}/[^/]+/$",
    category: "POLICY",
    channel: "AU",
    maxItems: 20,
  },
  {
    name: "Accountants Daily",
    url: "https://www.accountantsdaily.com.au/news?format=feed&type=rss",
    category: "POLICY",
    channel: "AU",
    maxItems: 20,
  },
  // Industry bodies are attributed advocacy, not independent confirmation.
  {
    name: "SMSF Association",
    url: "https://www.smsfassociation.com/feed",
    category: "POLICY",
    channel: "AU",
    maxItems: 10,
  },
  {
    name: "UDIA National",
    url: "https://udia.com.au/feed/",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 10,
  },
  {
    name: "Master Builders Australia",
    url: "https://masterbuilders.com.au/feed/",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 10,
  },
  {
    name: "The Adviser",
    url: "https://www.theadviser.com.au/news?format=feed&type=rss",
    category: "MARKETS",
    channel: "AU",
    maxItems: 20,
  },
  {
    name: "Mortgage Professional Australia",
    url: "https://www.mpamag.com/au/rss",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 20,
  },
  {
    name: "RBA Interviews & Speeches",
    url: `https://www.rba.gov.au/speeches/${new Date().getUTCFullYear()}/`,
    kind: "index",
    articlePath: "^/speeches/20[0-9]{2}/sp-[a-z-]+20[0-9]{2}-[0-9]{2}-[0-9]{2}\\.html$",
    category: "MACRO",
    channel: "AU",
    maxItems: 12,
  },
  {
    name: "ABS Media Releases",
    url: "https://www.abs.gov.au/media-centre/media-releases",
    kind: "index",
    articlePath: "^/media-centre/media-releases/[^/]+$",
    category: "ECONOMICS",
    channel: "AU",
    maxItems: 20,
  },
  {
    name: "realestate.com.au News",
    // RSS returns 403; the public newsroom exposes ordinary headline links.
    url: "https://www.realestate.com.au/news/",
    kind: "index",
    articlePath: "^/news/[^/]+/$",
    articleLinkClass: "article-summary-title-link",
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 25,
  },
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

  // ── Tier 2: Australian newsrooms with reliable RSS ───────────────────────
  {
    name: "ABC News Business",
    url: "https://www.abc.net.au/news/feed/51892/rss.xml",
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
    name: "The Conversation · Business",
    url: "https://theconversation.com/au/business/articles.atom",
    category: "MARKETS",
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
    url: googleNews("APRA Australia lending OR serviceability OR banks"),
    category: "POLICY",
    channel: "AU",
    maxItems: 3,
  },
  // ASIC has its own beat — adviser-side conduct, licensing, enforcement —
  // distinct from APRA's lending/prudential brief. Publisher weighting uses
  // the resolved domain, never the search query or display name.
  {
    name: "ASIC & Conduct",
    url: googleNews(
      'ASIC OR "Australian Securities and Investments Commission" enforcement OR licensing OR "best interests"'
    ),
    category: "POLICY",
    channel: "AU",
    maxItems: 2,
  },
  {
    name: "Mortgage Brokers & Lending",
    url: googleNews('Australia "mortgage broker" OR "broker channel" OR "fixed rate" mortgage'),
    category: "MARKETS",
    channel: "AU",
    maxItems: 3,
  },
  // Trade-press angle on the broker channel — aggregators, commissions,
  // trail, the named houses. Complements the generic "mortgage broker"
  // query above by surfacing the channel-business stories that lead in
  // The Adviser / MPA / Australian Broker but rarely make the masthead.
  {
    name: "Broker Channel Trade",
    url: googleNews(
      'Australia "mortgage aggregator" OR "trail commission" OR AFG OR "Loan Market" OR "Connective" OR "Mortgage Choice"'
    ),
    category: "MARKETS",
    channel: "AU",
    maxItems: 2,
  },
  // Super / SMSF beat — the adviser-and-accountant centre of gravity. Was
  // completely missing from the AU flagship, which is why advice-side
  // stories rarely topped the priority sort even on weeks with major
  // contribution-cap or preservation changes.
  {
    name: "Super & SMSF",
    url: googleNews(
      'Australia superannuation OR SMSF OR "preservation age" OR "concessional contribution" OR "transfer balance cap"'
    ),
    category: "POLICY",
    channel: "AU",
    maxItems: 3,
  },
  // ATO & tax — accountant-channel centre of gravity. Pairs with super
  // above as the wealth-strategy beat.
  {
    name: "ATO & Tax",
    url: googleNews(
      'Australia ATO OR "Australian Taxation Office" OR "tax return" OR "Division 7A" OR "Part IVA"'
    ),
    category: "POLICY",
    channel: "AU",
    maxItems: 3,
  },
  {
    name: "Australian Market Close",
    // A dedicated closing-report query avoids using an intraday rates article
    // as evidence for the final index move. Original article checks still apply.
    url: googleNews('(ASX OR "Australian shares") (closed OR closes OR "market close")'),
    category: "MARKETS",
    channel: "AU",
    maxItems: 6,
  },
  {
    name: "South Coast Housing",
    url: googleNews(
      '(Bega OR "Bega Valley" OR Eurobodalla OR Shoalhaven) (housing OR homes OR planning OR subdivision)'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 6,
  },
  {
    name: "Short-stay Housing Policy",
    url: googleNews(
      '(Australia OR Tasmania OR Victoria OR NSW) ("short-stay" OR "short-term accommodation" OR Airbnb) (levy OR tax OR bill OR regulation)'
    ),
    category: "POLICY",
    channel: "PROPERTY",
    maxItems: 6,
  },
  {
    name: "Australian Industry Regulation",
    url: googleNews(
      'Australia (packaging OR recycling OR "plastic waste") (laws OR reform OR regulation OR standards)'
    ),
    category: "POLICY",
    channel: "AU",
    maxItems: 4,
  },
  {
    name: "Northern Rivers Housing",
    // Border-region reports often omit the state name. This complements the
    // statewide query; it does not certify any consultation as new publication.
    url: googleNews(
      '(Tweed OR "Northern Rivers" OR Lismore OR Ballina) (housing OR homes OR rents OR Landcom)'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 8,
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
    url: googleNews('Australia inflation OR CPI OR "Reserve Bank" GDP OR unemployment'),
    category: "ECONOMICS",
    channel: "AU",
    maxItems: 2,
  },

  // ── International finance belongs in Business, including US housing. ────
  // An Australian reader angle does not change the geography of the news.
  {
    name: "Global · Central banks",
    url: googleNewsGlobal('Federal Reserve OR ECB OR "Bank of England" OR "Bank of Japan" rates'),
    category: "MACRO",
    channel: "BUSINESS",
    maxItems: 2,
  },
  {
    name: "Global · Markets & rates",
    url: googleNewsGlobal('"10-year yield" OR "S&P 500" OR "dollar index"'),
    category: "MARKETS",
    channel: "BUSINESS",
    maxItems: 2,
  },
  {
    name: "Global · US property & mortgage",
    url: googleNewsGlobal('US "housing market" OR "mortgage rates" OR "home prices"'),
    category: "PROPERTY",
    channel: "BUSINESS",
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
      'Australia ("property prices" OR "housing market" OR "house prices") -realestate.com.au/buy'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 4,
  },
  {
    name: "Sydney & Melbourne Auctions",
    url: googleNews('("auction clearance" OR "auction results") Sydney OR Melbourne'),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "Buyer's Agents & Investors",
    url: googleNews('"buyer\'s agent" Australia OR "property investor" Australia'),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },
  {
    name: "AU Rental & Construction",
    url: googleNews(
      'Australia ("rental market" OR "housing supply" OR "dwelling approvals" OR "residential construction")'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 3,
  },
  // Direct property-data narrative — CoreLogic's monthly hedonic, Domain's
  // research, the named metrics ("home values", "vendor discount", "days on
  // market") that drive buyer's-agent and adviser conversations. The
  // existing PROPERTY sources surface market headlines; this surfaces the
  // data-release stories that lead with a number.
  {
    name: "CoreLogic & Property Data",
    url: googleNews(
      'CoreLogic OR Domain OR PropTrack "home values" OR "vendor discount" OR "days on market" OR "auction clearance" Australia'
    ),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 2,
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
 * Minimum relevant local stories for a run to ship. Quality checks come first;
 * never pad a quiet day to meet a numerical quota.
 */
export const DAILY_ITEM_MIN = 1;
