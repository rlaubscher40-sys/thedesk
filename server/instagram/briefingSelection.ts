import type { DailyFeedItem } from "../db/schema";
import { propertyStoryTier } from "./propertyEditorial";
import { briefingReady, briefingLens, briefingClaimLabel } from "./briefing";
import { storyPublicationKeys } from "./socialProvenance";
import { unpublishedSocialStories } from "./socialPublication";

/** Editorial ordering, not a truth score. Only publisher copy contributes. */
export function assessBriefingStory(story: DailyFeedItem) {
  const tier = propertyStoryTier(story);
  const text = `${story.title} ${story.summary ?? ""}`;
  const promotional =
    /\b(sponsored|advertorial|partner content|register now|book (?:your|a) (?:free )?(?:consultation|inspection)|investment opportunity|dream home|luxury living)\b/i.test(
      text
    );
  const boilerplate =
    /^(?:it['’]s why we|we['’]re (?:committed|delivering)|find out more|read more|subscribe to|sign up for)\b/i.test(
      story.summary?.trim() ?? ""
    );
  const auctionMismatch =
    /\bauction sales\b/i.test(story.title) &&
    /\bclearance rates?\b/i.test(story.summary ?? "") &&
    !/\b(?:auction sales|sales volumes?|number of (?:sales|auctions))\b/i.test(story.summary ?? "");
  const hold = !tier
    ? "Outside current Australian property criteria"
    : promotional
      ? "Promotional copy"
      : boilerplate
        ? "Summary lacks a standalone reported finding"
        : auctionMismatch
          ? "Headline and summary use different auction measures"
          : !briefingReady(story)
            ? "Source detail is missing, ambiguous or too long"
            : storyPublicationKeys(story).length !== 2
              ? "Usable source URL missing"
              : null;
  const estimate = briefingClaimLabel(story) === "REPORTED ESTIMATE";
  const commentary =
    /\b(opinion|commentary|maybe|I think|we believe)\b/i.test(text) || /\?\s*$/.test(story.title);
  const announcement = /\b(joint statement|media release|announc\w*|pledge\w*|propos\w*)\b/i.test(
    text
  );
  const data =
    /\b(data|figures|statistics|survey|index|clearance rates?|rents paid|building approvals)\b/i.test(
      text
    ) && /\d/.test(text);
  const kind = estimate
    ? "Forecast or modelling"
    : commentary
      ? "Commentary or question"
      : announcement
        ? "Announcement or proposal"
        : data
          ? "Reported data"
          : "Reported news";
  // Observed data/news lead ahead of forecasts and commentary, even when an
  // ingestion model gave a dramatic headline a higher priority.
  const merit = estimate || commentary ? 0 : announcement ? 1 : data ? 3 : 2;
  return { hold, tier, kind, merit, topic: briefingLens(story).key };
}

export function pickBriefingStories(stories: DailyFeedItem[], limit = 3): DailyFeedItem[] {
  if (!Number.isFinite(limit) || limit < 1) return [];
  const ranked = stories
    .map((story) => ({ story, assessment: assessBriefingStory(story) }))
    .filter((row) => !row.assessment.hold)
    .sort(
      (a, b) =>
        b.assessment.merit - a.assessment.merit ||
        b.assessment.tier - a.assessment.tier ||
        (Number.isFinite(b.story.priority) ? b.story.priority : 0) -
          (Number.isFinite(a.story.priority) ? a.story.priority : 0) ||
        a.story.id - b.story.id
    );
  const seen = new Set<string>();
  const selected: DailyFeedItem[] = [];
  for (const { story } of ranked) {
    const keys = storyPublicationKeys(story);
    if (seen.has(`id:${story.id}`) || keys.some((key) => seen.has(key))) continue;
    seen.add(`id:${story.id}`);
    keys.forEach((key) => seen.add(key));
    selected.push(story);
    if (selected.length >= Math.floor(limit)) break;
  }
  return selected;
}

/** Check every eligible item before limiting, so six used stories cannot hide
 * the seventh fresh story. The feed query is already bounded by the feed day. */
export async function unpublishedBriefingSelection(stories: DailyFeedItem[], limit = 3) {
  const ranked = pickBriefingStories(stories, stories.length);
  return (await unpublishedSocialStories(ranked)).slice(0, limit);
}
