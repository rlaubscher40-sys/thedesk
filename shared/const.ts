/** Single source of truth for cross-tier constants. */

export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;

export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

/**
 * Partner personas surfaced on every daily feed item. The order is the order
 * shown in the UI, so do not reorder without a coordinated change in the
 * sidebar persona selector.
 */
export const PARTNER_PERSONAS = [
  "Brokers",
  "Financial Advisers",
  "Accountants",
  "SMSF Specialists",
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
