/** Single source of truth for cross-tier constants. */

export const COOKIE_NAME = "app_session_id";
/**
 * Admin session lifetime. 30 days balances single-user convenience against
 * the blast radius of a stolen cookie — a leaked session now ages out in a
 * month instead of the year it used to be valid for.
 */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;

/**
 * How long a subscribe confirmation link stays valid. The confirm email
 * promises "expires in 24 hours"; this is the value that enforces it.
 */
export const CONFIRM_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

/**
 * Public-facing URL of the site. Used in LinkedIn share text, RSS scraper
 * User-Agent, and anywhere we need to point readers back at the site.
 *
 * Override via `VITE_SITE_URL` (Vite-compiled client code) or `SITE_URL`
 * (Node scripts). When neither is set, falls back to the demo URL.
 */
export const DEFAULT_SITE_URL = "https://thedesk.au";

/**
 * Reader positions — where someone stands in relation to the property market,
 * which is the thing that changes what a story means to them.
 *
 * These replaced the old partner roles (Broker / Adviser / Buyers Agent). That
 * set was inherited from an earlier life of this codebase as an internal
 * briefing tool, and it put the wrong reader in the model's head on every
 * generation: The Desk is a subscription publication for people who follow
 * Australian property, not a channel-marketing tool aimed at intermediaries.
 *
 * Kept to three because a reader recognises themselves instantly in one of
 * them, and because a fourth would mostly be a rewording of an existing one.
 *
 * Matches `READER_ANGLE_LABELS` (`shared/schemas.ts`) and the `POSITION_COLOUR`
 * map (`client/src/lib/persona.tsx`). The canonical keys stay one bare word so
 * they survive as line prefixes in stored text and in a regex;
 * `positionDisplayLabel` expands them for the reader.
 *
 * Note that rows written before this change carry the old labels and will no
 * longer parse, so the angles block simply does not render on them. That is
 * the intended outcome: the old lines were addressed to brokers, and there is
 * no honest mapping from "Broker" to a reader position.
 */
export const READER_POSITIONS = ["Buying", "Holding", "Watching"] as const;
export type ReaderPosition = (typeof READER_POSITIONS)[number];

/**
 * Feed channels — the Discover-style content lanes on the Today page. A
 * channel is a SEPARATE axis from {@link CATEGORIES}: a channel is the
 * editorial lane a story belongs in (Australia, Property, Business, Tech,
 * Global), whereas a category is its topic (MACRO, MARKETS, AI…). The Today
 * page renders one tab per channel; the category sub-filter only appears on
 * the AU flagship.
 *
 * Order is the tab order.
 */
export const FEED_CHANNELS = ["AU", "PROPERTY", "BUSINESS", "TECH", "GLOBAL"] as const;
export type FeedChannel = (typeof FEED_CHANNELS)[number];

/** Tab labels for each channel, in The Desk's editorial register. */
export const FEED_CHANNEL_LABELS: Record<FeedChannel, string> = {
  AU: "Australia's Top Stories",
  PROPERTY: "Property",
  BUSINESS: "Business",
  TECH: "Tech & Science",
  GLOBAL: "Global Top Stories",
};

/** The default channel shown when the Today page first loads. */
export const DEFAULT_FEED_CHANNEL: FeedChannel = "AU";

/**
 * Channels that receive the expensive editorial enrichment (partner angles,
 * Say This, Why it matters, Counterpoint, Ruben's note). Only the
 * partner-relevant Australian lanes are enriched; the rest are coverage-only
 * (headline + summary + source + image + timestamp).
 */
export const ENRICHED_CHANNELS = ["AU", "PROPERTY"] as const;

/** Whether a channel gets the full angle-block enrichment. */
export function isEnrichedChannel(channel: string | null | undefined): boolean {
  return (ENRICHED_CHANNELS as readonly string[]).includes(
    (channel ?? DEFAULT_FEED_CHANNEL).toUpperCase()
  );
}

/** Categories used across feed items and edition topics. */
export const CATEGORIES = [
  "PROPERTY",
  "MACRO",
  "MARKETS",
  "POLICY",
  "TECH",
  "AI",
  "GEOPOLITICS",
  "SCIENCE",
  "ECONOMICS",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** LinkedIn character thresholds for the share modal counter. */
export const LINKEDIN_LIMITS = {
  /** Optimal upper bound, counter goes green up to here. */
  recommended: 2500,
  /** Hard upper bound, LinkedIn truncates beyond ~3,000. */
  max: 3000,
} as const;

/**
 * Every kind of Instagram feed post the site publishes and records.
 *
 * One list, because two things depend on it agreeing with itself. The admin
 * panel groups performance by these keys, and the profile grid flips its
 * navy/light cover from the newest post of any of them — so a type recorded
 * but missing from the list is invisible to the flip, and the post after it
 * lands on the same tone as its neighbour. Adding a post type means adding it
 * here, and everything that has to know follows.
 *
 * Order is the day's running order, which is also how the admin panel reads.
 */
export const INSTAGRAM_POST_TYPES = [
  "daily",
  "stat",
  "reel",
  "weekly",
  "monthly",
  "coverage",
  "launch",
] as const;
export type InstagramPostType = (typeof INSTAGRAM_POST_TYPES)[number];

/** Audience-facing name of each post type — the title it wears on the grid.
 *  The admin surfaces should say what you would see on the profile, not the
 *  internal key. */
export const INSTAGRAM_POST_TYPE_LABELS: Record<InstagramPostType, string> = {
  daily: "Today's Briefing",
  stat: "The Number",
  reel: "The Number, on video",
  weekly: "This Week",
  monthly: "The Month in Numbers",
  coverage: "The Wider Lens",
  launch: "Profile launch",
};
