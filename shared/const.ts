/** Single source of truth for cross-tier constants. */

export const COOKIE_NAME = "app_session_id";
/**
 * Admin session lifetime. 30 days balances single-user convenience against
 * the blast radius of a stolen cookie — a leaked session now ages out in a
 * month instead of the year it used to be valid for.
 */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;

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
 * Partner personas. The canonical four, matches `PARTNER_TAG_LABELS`
 * (`shared/schemas.ts`), the `PERSONA_COLOUR` map
 * (`client/src/lib/persona.tsx`), and the three-line Partner angles block
 * that runs under every tagged story. See `docs/brand-guidelines.md`
 * Section 2 for what each role reads The Desk for.
 *
 * Order is the order shown in any UI that lists them. Canonical key
 * "Adviser" covers the combined Financial Adviser / Accountant slot —
 * `personaDisplayLabel` expands it on the surface.
 */
export const PARTNER_PERSONAS = ["Broker", "Adviser", "Buyers Agent"] as const;
export type PartnerPersona = (typeof PARTNER_PERSONAS)[number];

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
