/**
 * The Desk Premium — single source of truth for the paid-tier pitch.
 *
 * Everything the founding-member surfaces show (price, cap, the free vs paid
 * split, the benefit list) lives here so the numbers can't drift between the
 * dedicated /founding page and the inline edition-foot upsell, and so Ruben
 * can change the price in one place.
 *
 * Important: nothing here charges anyone. The founding surfaces capture
 * *interest* through the existing double-opt-in `subscribers.subscribe`
 * mutation (with a distinct `source`) and send the normal confirm email.
 * Billing runs through Substack later; these surfaces exist to (a) validate
 * willingness to pay before any billing is built and (b) build a warm list
 * to convert on launch day. Copy on every surface must say "no charge today".
 */

/** Public price once Premium opens. Roughly a dollar a week. */
export const PREMIUM_PRICE = "$5";
export const PREMIUM_CADENCE = "/month";

/** Founding rate — locked for life for the first cohort. Set below the
 *  public price so "founding" means something concrete. */
export const FOUNDING_PRICE = "$3";

/** How many founding spots. Powers the honest-scarcity line. Keep it a
 *  number you'll actually hold the line on. */
export const FOUNDING_CAP = 100;

/** Attribution sources, kept here so admin can filter the subscriber table
 *  by exactly these strings. */
export const FOUNDING_SOURCE_PAGE = "founding-page";
export const FOUNDING_SOURCE_EDITION_FOOT = "founding-edition-foot";

/** What stays free forever. The "news" half of give-away-the-news,
 *  sell-the-judgment. */
export const FREE_TIER: readonly string[] = [
  "The daily brief, every weekday at 7am AEST",
  "The Sunday edition headlines and lead story",
  "The full public archive",
];

/** What Premium adds. The "judgment" half — the part an LLM can't replicate
 *  because it is Ruben's read, not a summary. */
export const PREMIUM_TIER: readonly string[] = [
  "Ruben's Take in full on every story, not just the lead",
  "The deal-relevant read: what each move means for buyers and where it points next",
  "Sunday deep dives on the numbers behind the week",
  "First access to data cuts and hotspot notes before they go anywhere else",
  "Direct reply line to Ruben on the week's calls",
];
