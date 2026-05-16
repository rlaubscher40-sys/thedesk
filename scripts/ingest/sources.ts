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
 *
 * Removed (broken in production, confirmed via GitHub Actions runs):
 *   - APRA, ABS, CoreLogic AU, PropTrack — RSS URLs wrong / 404
 *   - ASIC — malformed XML the parser rejects
 *   - Domain News, Livewire Markets, MacroBusiness — Cloudflare blocks
 *     GitHub Actions IPs (403 / timeout)
 *   - Reddit (all subs) — Reddit blocks unauthenticated public RSS from
 *     GitHub-hosted IPs (would need a proxy or hosted runner)
 *   - ABC News Politics — leaks sport into POLICY (Magic Round stories,
 *     etc). Guardian AU Politics covers this beat without the sport leak.
 *   - ABC News Technology — low signal, mostly product launches.
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
  // ── Regulators & official ────────────────────────────────────────────────
  // First-class signal — the institutions that move markets.
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

  // ── Business / Markets ──────────────────────────────────────────────────
  {
    name: "ABC News Business",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
    category: "MARKETS",
    maxItems: 5,
  },
  {
    name: "Guardian AU Business",
    url: "https://www.theguardian.com/au/business/rss",
    category: "MARKETS",
    maxItems: 4,
  },

  // ── Policy / Politics ───────────────────────────────────────────────────
  // Note: only Guardian Politics. ABC News Politics is dropped because its
  // feed mixes Magic Round / sport stories that then get tagged POLICY.
  {
    name: "Guardian AU Politics",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
    category: "POLICY",
    maxItems: 3,
  },
];

/** How many items to ship per daily run after dedup. */
export const DAILY_ITEM_TARGET = 16;
export const DAILY_ITEM_MIN = 6;
