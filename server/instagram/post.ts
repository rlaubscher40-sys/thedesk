/**
 * High-level Instagram posting orchestration.
 *
 * postDailyCarousel  — picks the top-3 stories by priority, renders a
 *                      1080×1080 card per story, posts as a carousel.
 *
 * postWeeklyEdition  — renders a cover card + one card per topic from
 *                      the latest weekly edition, posts as a carousel.
 *
 * Both functions store image buffers in the in-memory tempStore so the
 * server can serve them at /instagram/temp/:uuid.jpg for the few seconds
 * Instagram's API needs to fetch them, then immediately clean up.
 */
import { env } from "../core/env";
import type { DailyFeedItem, Edition } from "../db/schema";
import {
  renderDailyStoryCard,
  renderWeeklyCoverCard,
  renderWeeklyTopicCard,
} from "../og/instagramCards";
import {
  createCarouselContainer,
  createImageContainer,
  publishContainer,
} from "./api";
import { removeTempImage, storeTempImage } from "./tempStore";

function buildDailyCaption(stories: DailyFeedItem[], siteUrl: string): string {
  const lead = stories[0];
  const why = lead?.whyItMatters?.slice(0, 260) ?? "";
  return [
    "Today's top stories from The Desk — Australia's financial intelligence briefing.",
    "",
    ...(why ? [why, ""] : []),
    "Swipe to see today's top stories →",
    "",
    `Full briefing at ${siteUrl} 🔗`,
    "",
    "#PropertyMarket #AustralianEconomy #RBA #Finance #Investing #ASX #TheDesk",
  ].join("\n");
}

function buildWeeklyCaption(edition: Edition, siteUrl: string): string {
  const take = edition.rubensTake?.slice(0, 300) ?? "";
  return [
    `Weekly Edition #${edition.editionNumber} — ${edition.weekRange}`,
    "",
    ...(take ? [take, ""] : []),
    `Read the full edition at ${siteUrl}/editions/${edition.editionNumber} 🔗`,
    "",
    "#WeeklyBriefing #PropertyMarket #AustralianEconomy #RBA #Finance #TheDesk #Investing",
  ].join("\n");
}

export async function postDailyCarousel(
  stories: DailyFeedItem[],
  siteUrl: string
): Promise<{ postId: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  // Top 3 by priority; all must have a title (enrichment may still be running)
  const top = [...stories]
    .sort((a, b) => b.priority - a.priority)
    .filter((s) => s.title)
    .slice(0, 3);

  if (top.length === 0) throw new Error("No stories available for Instagram post");

  const uuids: string[] = [];
  try {
    for (let i = 0; i < top.length; i++) {
      const buf = await renderDailyStoryCard(top[i]!, i, top.length);
      uuids.push(storeTempImage(buf));
    }

    const caption = buildDailyCaption(top, siteUrl);

    // Create child containers in parallel — Instagram fetches each image URL
    const childIds = await Promise.all(
      uuids.map((uuid) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          isCarouselItem: true,
        })
      )
    );

    const carouselId = await createCarouselContainer({
      igUserId,
      accessToken,
      childrenIds: childIds,
      caption,
    });
    const postId = await publishContainer({ igUserId, accessToken, creationId: carouselId });

    console.log(`[instagram] daily carousel posted: ${postId}`);
    return { postId };
  } finally {
    uuids.forEach(removeTempImage);
  }
}

export async function postWeeklyEdition(
  edition: Edition,
  siteUrl: string
): Promise<{ postId: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  const topics = edition.topics.slice(0, 4);
  const totalSlides = 1 + topics.length;
  const uuids: string[] = [];

  try {
    // Slide 1: cover
    uuids.push(storeTempImage(await renderWeeklyCoverCard(edition)));

    // Slides 2–N: one per topic
    for (let i = 0; i < topics.length; i++) {
      const buf = await renderWeeklyTopicCard(topics[i]!, i + 1, totalSlides);
      uuids.push(storeTempImage(buf));
    }

    const caption = buildWeeklyCaption(edition, siteUrl);

    const childIds = await Promise.all(
      uuids.map((uuid) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          isCarouselItem: true,
        })
      )
    );

    const carouselId = await createCarouselContainer({
      igUserId,
      accessToken,
      childrenIds: childIds,
      caption,
    });
    const postId = await publishContainer({ igUserId, accessToken, creationId: carouselId });

    console.log(
      `[instagram] weekly edition ${edition.editionNumber} posted: ${postId}`
    );
    return { postId };
  } finally {
    uuids.forEach(removeTempImage);
  }
}
