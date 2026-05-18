/**
 * Editorial priority defaults for a freshly-ingested feed item.
 *
 * Higher priority = more lead-worthy. Range 0-100. The Today page sorts
 * items by `priority DESC, createdAt DESC` so the highest-impact story
 * lands as the hero rather than just the most recently ingested one.
 *
 * Two layers compose the default:
 *   - Category baseline, partnership pros' hierarchy of interest. Budget,
 *     RBA decisions, lending policy and property data dominate. AI and
 *     tech stories matter but rarely lead. Sport / entertainment never
 *     leads.
 *   - Source bonus, primary regulators and serious mastheads outrank
 *     aggregators and social.
 *
 * The admin can override the computed priority on any item via
 * `feed.setPriority`, manual control always wins.
 */

const CATEGORY_BASELINE: Record<string, number> = {
  POLICY: 65,
  MACRO: 65,
  PROPERTY: 60,
  ECONOMICS: 55,
  MARKETS: 50,
  GEOPOLITICS: 50,
  AI: 35,
  TECH: 30,
  SCIENCE: 25,
  OTHER: 20,
};

/**
 * Source-name fragments that bump priority. Match is substring-insensitive
 * so "ABC News Business" picks up the ABC bonus and "Google · Top headlines"
 * doesn't get one.
 */
const PRIMARY_SOURCE_FRAGMENTS = [
  "rba",
  "treasury",
  "apra",
  "asic",
  "abs ",
  "australian bureau",
  "afr",
  "financial review",
  "abc news",
  "reserve bank",
];

const SECONDARY_SOURCE_FRAGMENTS = [
  "guardian",
  "the conversation",
  "domain",
  "corelogic",
  "westpac",
  "anz research",
];

/**
 * Compute a default priority for a freshly-ingested item. Capped at 95
 * so manual admin overrides at 100 always trump the heuristic.
 */
export function defaultFeedPriority(args: {
  category: string;
  source: string;
}): number {
  const key = args.category?.toUpperCase() ?? "OTHER";
  const baseline = CATEGORY_BASELINE[key] ?? CATEGORY_BASELINE.OTHER!;
  const haystack = (args.source ?? "").toLowerCase();
  let bonus = 0;
  if (PRIMARY_SOURCE_FRAGMENTS.some((f) => haystack.includes(f))) {
    bonus = 15;
  } else if (SECONDARY_SOURCE_FRAGMENTS.some((f) => haystack.includes(f))) {
    bonus = 7;
  }
  return Math.min(95, baseline + bonus);
}
