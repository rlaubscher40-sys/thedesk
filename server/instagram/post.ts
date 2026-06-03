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

/** Evergreen hashtags on every post, kept tight so the feed doesn't read as
 *  tag-stuffed. One beat-specific tag (below) is appended per post. */
const CORE_HASHTAGS = "#AusFinance #AusProperty #AusEconomy #RBA #ASX200 #TheDesk";

/**
 * One discovery hashtag tuned to the lead story's beat, appended to the core
 * set so each post reaches the right niche without hand-curating tags.
 */
const CATEGORY_HASHTAG: Record<string, string> = {
  ECONOMY: "#InterestRates",
  ECONOMICS: "#InterestRates",
  MACRO: "#InterestRates",
  PROPERTY: "#PropertyMarket",
  MARKETS: "#ASX",
  POLICY: "#AusPolicy",
  AI: "#AI",
  TECH: "#TechNews",
  GEOPOLITICS: "#GlobalMarkets",
};

function categoryHashtag(category: string | null | undefined): string {
  return CATEGORY_HASHTAG[(category ?? "").toUpperCase()] ?? "#Markets";
}

/**
 * The caption leads with a hook + benefit (the first ~125 chars are all
 * Instagram shows before "…more"), carries the conversational "say this" hook
 * for each slide in swipe order, then asks for a comment and a save — for
 * evergreen brief content, saves are the strongest ranking signal. The
 * analytical why-it-matters stays on the cards so the caption doesn't repeat
 * them.
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

  const tags = `${CORE_HASHTAGS} ${categoryHashtag(stories[0]?.category)}`;

  return [
    "The stories moving Australian markets today, and what each one means for your money. ↓",
    "",
    ...rundown,
    "Which one are you watching this week? Tell us below.",
    "↳ Save this so you've got the brief for the days ahead.",
    "",
    "The full daily briefing is in our bio.",
    "",
    tags,
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
  const topics = edition.topics.slice(0, 4);
  const contents = topics.map((t) => `· ${sanitizeDashes(t.title).slice(0, 90)}`);
  const tags = `${CORE_HASHTAGS} #WeeklyBriefing ${categoryHashtag(topics[0]?.category)}`;

  return [
    "This week in Australian property & markets, the calls that mattered and what comes next. ↓",
    "",
    ...(take ? [take, ""] : []),
    `Inside Edition #${edition.editionNumber}:`,
    ...contents,
    "",
    "Which call are you watching? Reply below.",
    "↳ Save the edition for the week ahead.",
    "",
    "The full weekly edition is in our bio.",
    "",
    tags,
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

    // Also share each of the day's stories to the 24h Story as its own frame,
    // so the Story carries the full top-3, not just the lead. Best-effort and
    // per-frame: a failure on one frame must never fail the feed post that has
    // already gone live, nor block the remaining frames.
    for (let i = 0; i < sanitized.length; i++) {
      try {
        const storyBuf = await renderDailyStoryVertical(sanitized[i]!, opts.variant ?? "navy");
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
        console.log(`[instagram] daily story ${i + 1}/${sanitized.length} posted: ${storyId}`);
      } catch (err) {
        const message = (err as Error).message;
        console.error(`[instagram] daily story ${i + 1} failed (feed post still live):`, message);
        // Record it so a Story failure is visible in the admin console instead
        // of silently disappearing the way it did before.
        await recordServerError({
          level: "warn",
          message: `Instagram daily story ${i + 1} failed: ${message}`.slice(0, 512),
          route: "instagram/daily-story",
        }).catch(() => {});
      }
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
