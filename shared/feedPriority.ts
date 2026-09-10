import { publisherWeight } from "./editorial";
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

/** Legacy callers without story evidence receive no publisher-name bonus. */
export function defaultFeedPriority(args: { category: string; source: string; sourceUrl?: string | null; title?: string; summary?: string | null }): number {
  return Math.min(95, (CATEGORY_BASELINE[args.category?.toUpperCase()] ?? 20) + publisherWeight({ ...args, title: args.title ?? "" }));
}
