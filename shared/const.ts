/** Single source of truth for cross-tier constants. */

export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
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
export const DEFAULT_SITE_URL = "https://thedeskglobal.manus.space";

/**
 * Partner personas. The canonical four — matches `PARTNER_TAG_LABELS`
 * (`shared/schemas.ts`), the `PERSONA_COLOUR` map
 * (`client/src/lib/persona.tsx`), and the four-line Partner angles block
 * that runs under every tagged story. See `docs/brand-guidelines.md`
 * Section 2 for what each persona reads The Desk for.
 *
 * Order is the order shown in any UI that lists them.
 */
export const PARTNER_PERSONAS = [
  "Institutional",
  "Broker",
  "Adviser",
  "Buyers Agent",
] as const;
export type PartnerPersona = (typeof PARTNER_PERSONAS)[number];

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
  /** Optimal upper bound — counter goes green up to here. */
  recommended: 2500,
  /** Hard upper bound — LinkedIn truncates beyond ~3,000. */
  max: 3000,
} as const;
