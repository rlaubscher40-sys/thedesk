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
import { updateFeedItemWhyItMatters } from "../db/feed";
import { recordServerError } from "../db/health";
import { generateInstagramHeadline } from "../prompts/instagramHeadline";
import { generateWhyItMatters } from "../prompts/whyItMatters";
import {
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
 * Caption mirrors the carousel: a numbered rundown where each entry is the
 * slide's headline followed by its why-it-matters line, in swipe order. Built
 * from the same sanitized stories that render the cards, so the caption and
 * the slides always line up.
 */
function buildDailyCaption(stories: DailyFeedItem[]): string {
  const rundown = stories.flatMap((s, i) => {
    const headline = sanitizeDashes(s.title).slice(0, 120);
    const lines = [`${i + 1}. ${headline}`];
    if (s.whyItMatters) {
      lines.push(sanitizeDashes(s.whyItMatters).slice(0, 200));
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
 * Guarantee every selected story carries a why-it-matters before it becomes a
 * slide. Enrichment normally fills this in, but a story can slip through
 * (enrichment skipped or still running), so we generate any missing line at
 * post time and persist it back to the feed item. Mutates `stories` in place.
 */
async function ensureWhyItMatters(stories: DailyFeedItem[]): Promise<void> {
  await Promise.all(
    stories.map(async (story, i) => {
      if (story.whyItMatters && story.whyItMatters.trim()) return;
      const why = await generateWhyItMatters({
        title: story.title,
        summary: story.summary,
        category: story.category,
      });
      if (!why) return;
      stories[i] = { ...story, whyItMatters: why };
      try {
        await updateFeedItemWhyItMatters(story.id, why);
      } catch (err) {
        // Persisting is best-effort; the slide already has its line in memory.
        console.warn(
          `[instagram] couldn't persist generated whyItMatters for ${story.id}:`,
          (err as Error).message
        );
      }
    })
  );
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

export async function postDailyCarousel(
  stories: DailyFeedItem[],
  siteUrl: string
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  // Pick top-3 stories, favouring category variety over raw priority.
  const eligible = [...stories]
    .filter((s) => s.title)
    .sort((a, b) => b.priority - a.priority);

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

  if (top.length === 0) throw new Error("No stories available for Instagram post");

  // Every slide must carry a why-it-matters. Generate + persist any that are
  // missing before we render the cards or build the caption.
  await ensureWhyItMatters(top);

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
  try {
    for (let i = 0; i < sanitized.length; i++) {
      const buf = await renderDailyStoryCard(sanitized[i]!, i, sanitized.length);
      uuids.push(storeTempImage(buf));
    }

    const caption = buildDailyCaption(sanitized);

    // Create child containers in parallel — Instagram fetches each image URL.
    // alt_text per slide is the story headline (accessibility + ranking signal).
    const childIds = await Promise.all(
      uuids.map((uuid, i) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          altText: sanitized[i]?.title,
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
      const storyBuf = await renderDailyStoryVertical(sanitized[0]!);
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

  try {
    // Slide 1: cover
    uuids.push(storeTempImage(await renderWeeklyCoverCard(sanitizedEdition)));

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

    console.log(
      `[instagram] weekly edition ${edition.editionNumber} posted: ${postId}`
    );

    // Share the edition to the 24h Story. Best-effort: a Story failure must
    // never fail the feed post that has already gone live.
    try {
      const storyBuf = await renderWeeklyStoryVertical(sanitizedEdition);
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
