import type { DailyFeedItem, Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";
import { sydneySocialClock } from "../../shared/instagramSchedule";

/** Publication must never inherit the website's latest-populated-day fallback. */
export async function currentSocialFeed(
  read: (date: string) => Promise<DailyFeedItem[]>,
  requestedDate?: string,
  now = new Date()
): Promise<{ date: string; items: DailyFeedItem[] }> {
  const date = sydneySocialClock(now).dateISO;
  if (requestedDate !== undefined && requestedDate !== date) return { date, items: [] };
  return { date, items: (await read(date)).filter((item) => item.feedDate === date) };
}

export function currentSocialEdition(editions: Edition[], now = new Date()): Edition | null {
  const { dateISO, dow } = sydneySocialClock(now);
  const monday = new Date(`${dateISO}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((dow + 6) % 7));
  const weekOf = monday.toISOString().slice(0, 10);
  return editions.find((edition) => edition.weekOf === weekOf) ?? null;
}

/** Questions guide a decision without asserting a new cause, forecast or local fact. */
export function propertyReadingQuestion(input: { title: string; summary?: string | null }): string {
  const text = `${input.title} ${input.summary ?? ""}`;
  if (/\b(approvals?|approved|development applications?)\b/i.test(text))
    return "Before counting new homes, check whether this measures approvals, starts or completions, and which area and period it covers.";
  if (/\b(auction|clearance)\b/i.test(text))
    return "Before comparing demand, check the number of auctions, reporting coverage and whether the clearance result is preliminary or final.";
  if (/\b(rents?|rental\w*|tenan\w*)\b/i.test(text))
    return "Before comparing rental markets, check whether this measures rent levels or rent growth, then compare local prices, costs and vacancy.";
  if (/\b(house prices?|home prices?|dwelling values?)\b/i.test(text))
    return "Before using this in an offer, check the area, dwelling type and measurement period against recent comparable sales.";
  if (/\b(cash rate|interest rates?|RBA|Reserve Bank|mortgage\w*|home loans?)\b/i.test(text))
    return "Before changing your budget, check your lender's actual rate, fees and repayment quote. Which part of this update applies to your loan?";
  return "Before acting, check the source date, affected area and eligibility. Which part applies to the property you are considering?";
}

/**
 * No social-only factual rewrite without a structured fact contract. Preserve
 * the feed headline; replace BOTH cached and freshly generated social angles.
 * This does not independently verify the underlying publisher or feed text.
 */
export function sourceGroundedStory(story: DailyFeedItem): DailyFeedItem {
  return {
    ...story,
    sayThis: null,
    whyItMatters: propertyReadingQuestion(story),
  };
}

export function sourceGroundedTopic(topic: EditionTopic): EditionTopic {
  return {
    ...topic,
    whyItMatters: propertyReadingQuestion(topic),
    keyTakeaway: undefined,
    whatToWatch: undefined,
  };
}

function attributedPath(path: string, medium: string, identity: string): string {
  const url = new URL(path, "https://thedesk.au");
  url.searchParams.set("utm_source", "instagram");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", `property_${identity}`);
  return url.toString();
}

/** Only server-owned routes and numeric identities, never a generated URL. */
export function storyDestination(story: Pick<DailyFeedItem, "id">): string {
  return Number.isSafeInteger(story.id) && story.id > 0
    ? attributedPath(`/story/${story.id}`, "carousel", `story_${story.id}`)
    : attributedPath("/", "carousel", "daily");
}

export function editionDestination(edition: Pick<Edition, "editionNumber">): string {
  return Number.isSafeInteger(edition.editionNumber) && edition.editionNumber > 0
    ? attributedPath(
        `/editions/${edition.editionNumber}`,
        "carousel",
        `edition_${edition.editionNumber}`
      )
    : attributedPath("/editions", "carousel", "weekly");
}

export function marketDataCta(): string {
  return `Explore the property data and its sources: ${attributedPath("/markets", "stat", "market_data")}`;
}
