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
import { getLatestEditionAsset } from "../db/editionAssets";
import { updateFeedItemSayThis, updateFeedItemWhyItMatters } from "../db/feed";
import { recordServerError } from "../db/health";
import { generateInstagramHeadline } from "../prompts/instagramHeadline";
import { generateSayThis } from "../prompts/sayThis";
import { generateWhyItMatters } from "../prompts/whyItMatters";
import {
  type CardVariant,
  renderDailyCoverCard,
  renderDailyStoryCard,
  renderDailyStoryVertical,
  renderWeeklyCoverCard,
  renderWeeklyStoryVertical,
  renderWeeklyTopicCard,
} from "../og/instagramCards";
import {
  createCarouselContainer,
  createImageContainer,
  createStoryContainer,
  publishContainer,
  waitForContainerReady,
} from "./api";
import { removeTempImage, storeTempImage } from "./tempStore";

/** Single source of truth for dash sanitization in Instagram content. */
export function sanitizeDashes(text: string): string {
  return text.replace(/[–—]/g, ", ");
}

function sanitizeStory(story: DailyFeedItem): DailyFeedItem {
  return {
    ...story,
    title: story.title ? sanitizeDashes(story.title) : story.title,
    whyItMatters: story.whyItMatters ? sanitizeDashes(story.whyItMatters) : story.whyItMatters,
    summary: story.summary ? sanitizeDashes(story.summary) : story.summary,
    source: story.source ? sanitizeDashes(story.source) : story.source,
    category: story.category ? sanitizeDashes(story.category) : story.category,
  };
}

/**
 * The caption carries the conversational "say this" hook for each slide, in
 * swipe order, while the cards carry the analytical why-it-matters. Splitting
 * it this way means the caption reads as a talk-track (built to spark replies)
 * rather than repeating what's already on the cards.
 */
function buildDailyCaption(stories: DailyFeedItem[]): string {
  const rundown = stories.flatMap((s, i) => {
    const headline = sanitizeDashes(s.title).slice(0, 120);
    const lines = [`${i + 1}. ${headline}`];
    if (s.sayThis) {
      lines.push(sanitizeDashes(s.sayThis).slice(0, 220));
    }
    lines.push("");
    return lines;
  });

  return [
    "Today's top stories from The Desk, Australia's financial intelligence briefing.",
    "",
    ...rundown,
    "Swipe through today's briefing →",
    "",
    "Full daily briefing, link in bio.",
    "",
    "#PropertyMarket #AustralianEconomy #RBA #Finance #Investing #ASX #TheDesk",
  ].join("\n");
}

/**
 * Guarantee every selected story carries the lines its slide and caption need
 * before posting: a why-it-matters (the card subtext) and a say-this (the
 * caption hook). Enrichment normally fills these in, but a story can slip
 * through (enrichment skipped or still running), so we generate any missing
 * line at post time and persist it back to the feed item. Mutates in place.
 */
async function ensureSlideContent(stories: DailyFeedItem[]): Promise<void> {
  await Promise.all(
    stories.map(async (story, i) => {
      const needWhy = !(story.whyItMatters && story.whyItMatters.trim());
      const needSay = !(story.sayThis && story.sayThis.trim());
      if (!needWhy && !needSay) return;

      const input = {
        title: story.title,
        summary: story.summary,
        category: story.category,
      };
      const [why, say] = await Promise.all([
        needWhy ? generateWhyItMatters(input) : Promise.resolve(null),
        needSay ? generateSayThis(input) : Promise.resolve(null),
      ]);

      if (why) {
        stories[i] = { ...stories[i]!, whyItMatters: why };
        await updateFeedItemWhyItMatters(story.id, why).catch((err) =>
          console.warn(
            `[instagram] couldn't persist whyItMatters for ${story.id}:`,
            (err as Error).message
          )
        );
      }
      if (say) {
        stories[i] = { ...stories[i]!, sayThis: say };
        await updateFeedItemSayThis(story.id, say).catch((err) =>
          console.warn(
            `[instagram] couldn't persist sayThis for ${story.id}:`,
            (err as Error).message
          )
        );
      }
    })
  );
}

/**
 * Load the edition's AI-generated hero image straight from the DB and return
 * it as a base64 data URI satori can embed. Best-effort: any miss (no asset
 * yet, DB down) returns null so the renderers fall back to the bundled hero
 * rather than failing the post.
 */
export async function loadEditionHeroDataUri(editionId: number): Promise<string | null> {
  try {
    const asset = await getLatestEditionAsset(editionId, "hero");
    if (!asset?.bytes?.length) return null;
    return `data:${asset.contentType};base64,${asset.bytes.toString("base64")}`;
  } catch (err) {
    console.warn(
      `[instagram] couldn't load edition ${editionId} hero, using fallback:`,
      (err as Error).message
    );
    return null;
  }
}

function buildWeeklyCaption(edition: Edition): string {
  const take = edition.rubensTake ? sanitizeDashes(edition.rubensTake).slice(0, 300) : "";
  return [
    `Weekly Edition #${edition.editionNumber}, ${sanitizeDashes(edition.weekRange ?? "")}`,
    "",
    ...(take ? [take, ""] : []),
    "Full weekly edition, link in bio.",
    "",
    "#WeeklyBriefing #PropertyMarket #AustralianEconomy #RBA #Finance #TheDesk #Investing",
  ].join("\n");
}

/**
 * Pick the top-3 stories for the daily carousel, favouring category variety
 * over raw priority. Exported so the admin preview route renders the exact
 * same selection the post would, without going through the posting flow.
 */
export function pickDailyTopStories(stories: DailyFeedItem[]): DailyFeedItem[] {
  const eligible = [...stories].filter((s) => s.title).sort((a, b) => b.priority - a.priority);

  const top: DailyFeedItem[] = [];
  const usedCategories = new Set<string>();
  for (const s of eligible) {
    if (top.length >= 3) break;
    const cat = (s.category ?? "NEWS").toUpperCase();
    if (!usedCategories.has(cat)) {
      top.push(s);
      usedCategories.add(cat);
    }
  }
  // Fill any remaining slots with the next highest-priority stories not already chosen
  for (const s of eligible) {
    if (top.length >= 3) break;
    if (!top.includes(s)) top.push(s);
  }
  return top;
}

export async function postDailyCarousel(
  stories: DailyFeedItem[],
  siteUrl: string,
  opts: {
    /** Cover variant for the grid thumbnail (alternated for the checkerboard). */
    variant?: CardVariant;
    /** Market metrics for the cover's lower-third strip, already value+unit formatted. */
    metrics?: Array<{ label: string; value: string }>;
  } = {}
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  const top = pickDailyTopStories(stories);

  if (top.length === 0) throw new Error("No stories available for Instagram post");

  // Every slide must carry a why-it-matters (card subtext) and a say-this
  // (caption hook). Generate + persist any that are missing before we render.
  await ensureSlideContent(top);

  // Punch up the raw feed titles for the card only (3 short LLM calls). Each
  // call falls back to the original title on SKIP or failure, so a weak rewrite
  // can never block the post.
  const headlines = await Promise.all(
    top.map((s) =>
      generateInstagramHeadline({
        title: s.title,
        summary: s.summary,
        category: s.category,
      })
    )
  );
  const punched = top.map((s, i) => ({ ...s, title: headlines[i] ?? s.title }));

  const sanitized = punched.map(sanitizeStory);
  const uuids: string[] = [];
  // alt_text per slide, kept in lockstep with uuids (cover + one per story).
  const altTexts: (string | undefined)[] = [];
  try {
    // Slide 1 is a branded cover (date + numbered contents). Instagram shows
    // slide 1 as the grid thumbnail, so leading with this makes the profile
    // read as a cohesive column of covers rather than dense, unrelated tiles.
    const coverBuf = await renderDailyCoverCard(
      sanitized,
      sanitized[0]?.feedDate,
      opts.variant ?? "navy",
      opts.metrics
    );
    uuids.push(storeTempImage(coverBuf));
    altTexts.push("The Desk daily briefing cover");

    for (let i = 0; i < sanitized.length; i++) {
      // Whole carousel shares the cover's variant so a light post reads as
      // one piece when swiped, not a light cover over navy slides.
      const buf = await renderDailyStoryCard(
        sanitized[i]!,
        i,
        sanitized.length,
        opts.variant ?? "navy"
      );
      uuids.push(storeTempImage(buf));
      altTexts.push(sanitized[i]?.title);
    }

    const caption = buildDailyCaption(sanitized);

    // Create child containers in parallel — Instagram fetches each image URL.
    // alt_text per slide is the cover/story headline (accessibility + ranking).
    const childIds = await Promise.all(
      uuids.map((uuid, i) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          altText: altTexts[i],
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

    // Also share the lead story to the 24h Story. Best-effort: a Story failure
    // must never fail the feed post that has already gone live.
    try {
      const storyBuf = await renderDailyStoryVertical(sanitized[0]!, opts.variant ?? "navy");
      const storyUuid = storeTempImage(storyBuf);
      uuids.push(storyUuid);
      const storyContainerId = await createStoryContainer({
        igUserId,
        accessToken,
        imageUrl: `${siteUrl}/instagram/temp/${storyUuid}.jpg`,
      });
      await waitForContainerReady({ containerId: storyContainerId, accessToken });
      const storyId = await publishContainer({
        igUserId,
        accessToken,
        creationId: storyContainerId,
      });
      console.log(`[instagram] daily story posted: ${storyId}`);
    } catch (err) {
      const message = (err as Error).message;
      console.error("[instagram] daily story failed (feed post still live):", message);
      // Record it so a Story failure is visible in the admin console instead of
      // silently disappearing the way it did before.
      await recordServerError({
        level: "warn",
        message: `Instagram daily story failed: ${message}`.slice(0, 512),
        route: "instagram/daily-story",
      }).catch(() => {});
    }

    return { postId, headline: sanitized[0]!.title };
  } finally {
    uuids.forEach(removeTempImage);
  }
}

export async function postWeeklyEdition(
  edition: Edition,
  siteUrl: string
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  const rawTopics = edition.topics.slice(0, 4);
  const sanitizedTopics = rawTopics.map((t) => ({
    ...t,
    title: sanitizeDashes(t.title),
    summary: sanitizeDashes(t.summary),
    category: sanitizeDashes(t.category),
    keyTakeaway: t.keyTakeaway ? sanitizeDashes(t.keyTakeaway) : t.keyTakeaway,
    whyItMatters: t.whyItMatters ? sanitizeDashes(t.whyItMatters) : t.whyItMatters,
  }));
  const sanitizedEdition: Edition = {
    ...edition,
    weekRange: edition.weekRange ? sanitizeDashes(edition.weekRange) : edition.weekRange,
    rubensTake: edition.rubensTake ? sanitizeDashes(edition.rubensTake) : edition.rubensTake,
    topics: sanitizedTopics,
  };
  const totalSlides = 1 + sanitizedTopics.length;
  const editionAlt = `Weekly Edition #${edition.editionNumber}, ${sanitizedEdition.weekRange ?? ""}`;
  const uuids: string[] = [];
  // alt_text per slide, parallel to uuids: cover first, then one per topic.
  const altTexts: string[] = [editionAlt];

  // The cover and the Story share the edition's own hero photo when one was
  // generated; null falls back to the bundled image inside the renderers.
  const heroDataUri = await loadEditionHeroDataUri(edition.id);

  try {
    // Slide 1: cover
    uuids.push(storeTempImage(await renderWeeklyCoverCard(sanitizedEdition, heroDataUri)));

    // Slides 2–N: one per topic
    for (let i = 0; i < sanitizedTopics.length; i++) {
      const buf = await renderWeeklyTopicCard(sanitizedTopics[i]!, i + 1, totalSlides);
      uuids.push(storeTempImage(buf));
      altTexts.push(sanitizedTopics[i]!.title);
    }

    const caption = buildWeeklyCaption(sanitizedEdition);

    const childIds = await Promise.all(
      uuids.map((uuid, i) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          altText: altTexts[i],
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

    console.log(`[instagram] weekly edition ${edition.editionNumber} posted: ${postId}`);

    // Share the edition to the 24h Story. Best-effort: a Story failure must
    // never fail the feed post that has already gone live.
    try {
      const storyBuf = await renderWeeklyStoryVertical(sanitizedEdition, heroDataUri);
      const storyUuid = storeTempImage(storyBuf);
      uuids.push(storyUuid);
      const storyContainerId = await createStoryContainer({
        igUserId,
        accessToken,
        imageUrl: `${siteUrl}/instagram/temp/${storyUuid}.jpg`,
      });
      await waitForContainerReady({ containerId: storyContainerId, accessToken });
      const storyId = await publishContainer({
        igUserId,
        accessToken,
        creationId: storyContainerId,
      });
      console.log(`[instagram] weekly story posted: ${storyId}`);
    } catch (err) {
      const message = (err as Error).message;
      console.error("[instagram] weekly story failed (feed post still live):", message);
      await recordServerError({
        level: "warn",
        message: `Instagram weekly story failed: ${message}`.slice(0, 512),
        route: "instagram/weekly-story",
      }).catch(() => {});
    }

    return { postId, headline: editionAlt };
  } finally {
    uuids.forEach(removeTempImage);
  }
}
