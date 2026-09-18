import { datedBriefingHold } from "../../shared/sourceTiming";
import { diverseCoverage } from "../../shared/coverageGroups";
import type { DailyFeedItem, DailyMetric } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";
import { foreignHousingHeadline } from "../../shared/australianScope";
import { propertyNewsHold } from "../../shared/propertyNewsQuality";
import { explainNoPick, pickStatOfTheDay, rehearsalStat, type HistoryPoint } from "./statPick";

// Editorial relevance is not a confidence score or a claim about causation.
// Only source headline/summary text counts; generated 'why it matters' copy
// must not be able to turn an unrelated story into property evidence.
const PROPERTY =
  /\b(housing|dwelling\w*|mortgage\w*|home loans?|rental\w*|rents?|renters?|tenan\w*|landlords?|real estate|(?:house|home|property) (?:prices?|values?|sales|listings?|market)|auction clearance|building approvals?|housing approvals?|residential (?:development\w*|approvals?))\b/i;
const HOUSING_SUPPLY =
  /\b(?:new|social|affordable) homes\b|\bhomes (?:built|delivered)\b|\bmaking way for more homes\b|\b(?:unlock(?:s|ed|ing)?|deliver(?:s|ed|ing)?) [0-9][0-9,]* homes\b|\b[0-9][0-9,]* homes (?:unlocked|fast.tracked)\b/i;
const FINANCING = /\b(cash rate|interest rates?|RBA|Reserve Bank|housing credit)\b/i;
const HOUSING_MARKET =
  /\b(?:homes?|houses?|properties|apartments?)\b.{0,50}\b(?:prices?|values?|market|declin(?:e|es|ing)|affordability|supply)\b/i;

// A channel label is not geographic evidence. Overseas housing headlines
// require a separate editorial decision, not automatic Australian hashtags.
const AUSTRALIAN_SCOPE =
  /\b(Australia\w*|Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Townsville|Newcastle|Wollongong|Geelong|Shepparton|Gold Coast|Sunshine Coast|NSW|New South Wales|Queensland(?:ers?)?|Victoria|Tasmania|Western Australia|South Australia|Northern Territory|RBA|Reserve Bank of Australia)\b/i;
const NEUTRAL_RELEASE = /^(new |latest |official |ABS )?(data|figures|statistics|report|update)\b/i;

function australianPropertyAssessment(input: {
  title: string;
  summary?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
}) {
  if (foreignHousingHeadline(input.title, input.sourceUrl, input.source))
    return { tier: 0, hold: "foreign-housing-story" };
  const text = `${input.title} ${input.summary ?? ""}`;
  if (!AUSTRALIAN_SCOPE.test(text) && !/\bACT\b/.test(text))
    return { tier: 0, hold: "missing-australian-geography" };
  // A passing mention in a broad politics article must not become the lead.
  const subject = NEUTRAL_RELEASE.test(input.title) ? text : input.title;
  // Elliptical suburb-price headlines still need explicit housing evidence in
  // the publisher summary. Never use generated implications or a lane label.
  const suburbPrices =
    /\bsuburbs?\b.{0,60}\b(?:prices?|values?)\b|\b(?:prices?|values?)\b.{0,60}\bsuburbs?\b/i.test(
      input.title
    ) &&
    !/\b(?:petrol|fuel|grocer\w*|food|electricity|energy|insurance|shares?|stocks?|tickets?)\b/i.test(input.title) &&
    /\b(?:house|home|dwelling|property|apartment|unit) (?:prices?|values?|market|downturn)\b/i.test(
      input.summary ?? ""
    );
  const vacancyReport =
    /^(?:national |residential )?vacancy rates\b/i.test(input.title) &&
    /\brental vacanc(?:y|ies)\b/i.test(input.summary ?? "");
  const tier =
    PROPERTY.test(subject) ||
    HOUSING_MARKET.test(subject) ||
    HOUSING_SUPPLY.test(subject) ||
    suburbPrices ||
    vacancyReport
      ? 2
      : FINANCING.test(subject)
        ? 1
        : 0;
  return { tier, hold: tier ? null : "no-property-or-financing-subject" };
}

export function australianPropertyTier(
  input: Parameters<typeof australianPropertyAssessment>[0]
): number {
  return australianPropertyAssessment(input).tier;
}

/** An edition's category or generated takeaway cannot manufacture relevance. */
export function pickPropertyTopics(topics: EditionTopic[], limit = 4): EditionTopic[] {
  const seen = new Set<string>();
  return topics
    .map((topic, index) => {
      return { topic, index, tier: australianPropertyTier(topic) };
    })
    .filter(({ topic, tier }) => topic.title?.trim() && topic.summary?.trim() && tier > 0)
    .sort((a, b) => b.tier - a.tier || a.index - b.index)
    .filter(({ topic }) => {
      const key = topic.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({ topic }) => topic);
}

export function propertyStoryTier(story: DailyFeedItem): number {
  return assessPropertyStory(story).tier;
}

/** Preserve the first concrete eligibility failure for admin and run audits. */
export function assessPropertyStory(story: DailyFeedItem) {
  const hold = !["AU", "PROPERTY"].includes(story.channel)
    ? "outside-australian-property-channels"
    : !story.title?.trim()
      ? "missing-headline"
      : !story.source?.trim()
        ? "missing-publisher"
        : (propertyNewsHold(story, story.feedDate) ??
          datedBriefingHold(story.sourceTiming, story.feedDate));
  return hold ? { tier: 0, hold } : australianPropertyAssessment(story);
}

/** Thin days stay thin. Never pad a property carousel with unrelated news. */
export function pickPropertyStories(stories: DailyFeedItem[], limit = 3): DailyFeedItem[] {
  if (!Number.isFinite(limit) || limit < 1) return [];
  const seen = new Set<string>();
  return diverseCoverage(stories.filter((story) => propertyStoryTier(story) > 0))
    .map((story) => ({ story, tier: propertyStoryTier(story) }))
    .filter(({ tier }) => tier > 0)
    .sort(
      (a, b) => b.story.priority - a.story.priority || b.tier - a.tier || a.story.id - b.story.id
    )
    .filter(({ story }) => {
      const headline = story.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const keys = [
        `id:${story.id}`,
        `title:${headline}`,
        ...(story.sourceUrl ? [`url:${story.sourceUrl}`] : []),
      ];
      if (keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      return true;
    })
    .slice(0, Math.floor(limit))
    .map(({ story }) => story);
}

// Exact existing series keys, never labels or inferred geography. New series
// need an explicit editorial decision before they can become an automatic Reel.
const DIRECT_METRICS = new Set([
  "auction_clearance",
  "dwelling_value",
  "mortgage_arrears",
  "building_approvals",
]);
const FINANCING_METRICS = new Set(["cash_rate"]);

export function propertyMetrics(metrics: DailyMetric[]): DailyMetric[] {
  return metrics.filter(
    (metric) => DIRECT_METRICS.has(metric.metricKey) || FINANCING_METRICS.has(metric.metricKey)
  );
}

/** Relevance never bypasses the original picker's evidence bar. */
export function pickPropertyStat(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now = new Date()
) {
  return (
    pickStatOfTheDay(
      metrics.filter((m) => DIRECT_METRICS.has(m.metricKey)),
      histories,
      now
    ) ??
    pickStatOfTheDay(
      metrics.filter((m) => FINANCING_METRICS.has(m.metricKey)),
      histories,
      now
    )
  );
}

export function rehearsePropertyStat(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now = new Date()
) {
  return (
    pickPropertyStat(metrics, histories, now) ??
    rehearsalStat(propertyMetrics(metrics), histories, now)
  );
}

export function explainNoPropertyStat(
  metrics: DailyMetric[],
  histories: Record<string, HistoryPoint[]>,
  now = new Date()
) {
  const eligible = propertyMetrics(metrics);
  return eligible.length
    ? `No property or cash-rate metric cleared the evidence bar. ${explainNoPick(eligible, histories, now)}`
    : "No eligible property or cash-rate metrics. Unrelated market moves are not property posts.";
}
