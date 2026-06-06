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
import { shouldShowSummary } from "../../shared/headline";
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
  isRateLimitError,
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
export function buildDailyCaption(stories: DailyFeedItem[]): string {
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
    "The stories moving Australian markets today, and what each one means for your money.",
    "",
    ...rundown,
    "Which one are you watching this week? Tell us below.",
    "Save this so you've got the brief for the days ahead.",
    "",
    "The full daily briefing is in our bio.",
    "",
    tags,
  ].join("\n");
}

/**
 * Caption for the midday "Wider lens" coverage carousel (Tech & Science,
 * Business, Global). Same shape as the daily caption, but no per-story say-this
 * hook (coverage carries no partner angle) and a broader, non-AU-markets intro.
 */
export function buildCoverageCaption(stories: DailyFeedItem[]): string {
  const rundown = stories.flatMap((s, i) => [
    `${i + 1}. ${sanitizeDashes(s.title).slice(0, 120)}`,
    "",
  ]);

  const tags = `${CORE_HASHTAGS} #TechNews #BusinessNews #WorldNews ${categoryHashtag(stories[0]?.category)}`;

  return [
    "The wider lens, today in tech, science, business and the world beyond the property desk.",
    "",
    ...rundown,
    "Which story should we dig into? Tell us below.",
    "Save this for the headlines that matter.",
    "",
    "The full briefing, across every beat, is in our bio.",
    "",
    tags,
  ].join("\n");
}

/**
 * Fill in the lines each slide and caption need — a why-it-matters (card
 * subtext) and a say-this (caption hook) — for any story missing them.
 * Enrichment normally provides these, but a story can slip through (enrichment
 * skipped or still running), so we generate at post time and persist back to
 * the feed item. A story the model SKIPs keeps an empty why-it-matters; the
 * caller drops those rather than render a blank card. Mutates in place.
 *
 * Options:
 *   - `sayThis` (default true): also fill the say-this caption hook. The
 *     coverage post turns this OFF — say-this is a partner-channel line and
 *     coverage stories (Tech/Business/Global) carry no partner angle.
 *   - `persist` (default true): write generated lines back to the feed item.
 *     The coverage post turns this OFF so generating a why-it-matters purely to
 *     render the IG card doesn't stamp partner-style context onto a coverage
 *     story on the website, which is meant to stay headline + summary only.
 */
async function ensureSlideContent(
  stories: DailyFeedItem[],
  opts: { sayThis?: boolean; persist?: boolean } = {}
): Promise<void> {
  const wantSay = opts.sayThis ?? true;
  const persist = opts.persist ?? true;
  await Promise.all(
    stories.map(async (story, i) => {
      const needWhy = !(story.whyItMatters && story.whyItMatters.trim());
      const needSay = wantSay && !(story.sayThis && story.sayThis.trim());
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
        if (persist) {
          await updateFeedItemWhyItMatters(story.id, why).catch((err) =>
            console.warn(
              `[instagram] couldn't persist whyItMatters for ${story.id}:`,
              (err as Error).message
            )
          );
        }
      }
      if (say) {
        stories[i] = { ...stories[i]!, sayThis: say };
        if (persist) {
          await updateFeedItemSayThis(story.id, say).catch((err) =>
            console.warn(
              `[instagram] couldn't persist sayThis for ${story.id}:`,
              (err as Error).message
            )
          );
        }
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
  const contents = topics.map((t) => `- ${sanitizeDashes(t.title).slice(0, 90)}`);
  const tags = `${CORE_HASHTAGS} #WeeklyBriefing ${categoryHashtag(topics[0]?.category)}`;

  return [
    "This week in Australian property and markets, the calls that mattered and what comes next.",
    "",
    ...(take ? [take, ""] : []),
    `Inside Edition #${edition.editionNumber}:`,
    ...contents,
    "",
    "Which call are you watching? Reply below.",
    "Save the edition for the week ahead.",
    "",
    "The full weekly edition is in our bio.",
    "",
    tags,
  ].join("\n");
}

/**
 * Slides in a daily carousel (excluding the cover), and the larger candidate
 * pool we generate why-it-matters across so off-topic stories (which the model
 * SKIPs) can be dropped while still filling the slides.
 */
const DAILY_SLIDE_COUNT = 3;
const DAILY_CANDIDATE_POOL = 6;

/**
 * Pick the top stories for the daily carousel, favouring category variety over
 * raw priority. Defaults to the slide count; the posting flow calls it with a
 * larger limit to build a candidate pool it can filter. Exported so the admin
 * preview route renders the same selection the post would.
 */
export function pickDailyTopStories(
  stories: DailyFeedItem[],
  limit = DAILY_SLIDE_COUNT
): DailyFeedItem[] {
  const eligible = [...stories].filter((s) => s.title).sort((a, b) => b.priority - a.priority);

  const top: DailyFeedItem[] = [];
  const usedCategories = new Set<string>();
  for (const s of eligible) {
    if (top.length >= limit) break;
    const cat = (s.category ?? "NEWS").toUpperCase();
    if (!usedCategories.has(cat)) {
      top.push(s);
      usedCategories.add(cat);
    }
  }
  // Fill any remaining slots with the next highest-priority stories not already chosen
  for (const s of eligible) {
    if (top.length >= limit) break;
    if (!top.includes(s)) top.push(s);
  }
  return top;
}

/**
 * How many of the carousel's stories also get a 24h Story frame. Kept at ONE
 * (the lead) on purpose: a Story is a single 9:16 publish, and posting three
 * back-to-back right after the carousel is exactly the burst that trips
 * Instagram's "Action is blocked" integrity limit. One lead Story keeps a
 * presence in the Stories tray at a fraction of the publish volume.
 */
const STORY_FRAME_COUNT = 1;

/**
 * Post the lead story (see STORY_FRAME_COUNT) to the 24h Story as a 9:16 frame.
 * Runs in the BACKGROUND after the carousel is live: the Stories API can stall,
 * and doing it inline blocked the response long enough that the whole post
 * looked "failed" even though the carousel had published. Decoupled, a Story
 * problem is logged (and surfaced in the admin health panel) but never affects
 * the feed post or the caller. Each frame owns and cleans up its own temp image.
 */
async function postStoryFrames(opts: {
  stories: DailyFeedItem[];
  variant: CardVariant;
  verticalOpts: { subtextLabel?: string; header?: string };
  siteUrl: string;
  igUserId: string;
  accessToken: string;
}): Promise<void> {
  const { stories, variant, verticalOpts, siteUrl, igUserId, accessToken } = opts;
  const frames = stories.slice(0, STORY_FRAME_COUNT);
  // Let the account breathe well clear of the carousel publish before touching
  // the API again — a generous gap is the single biggest lever against the
  // "Action is blocked" integrity flag, and this is background work so the wait
  // costs nothing. Frames (if ever >1) are spaced out for the same reason.
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await settle(45000);
  for (let i = 0; i < frames.length; i++) {
    if (i > 0) await settle(20000);
    const uuids: string[] = [];
    try {
      const storyBuf = await renderDailyStoryVertical(frames[i]!, variant, verticalOpts);
      const storyUuid = storeTempImage(storyBuf);
      uuids.push(storyUuid);
      const containerId = await createStoryContainer({
        igUserId,
        accessToken,
        imageUrl: `${siteUrl}/instagram/temp/${storyUuid}.jpg`,
      });
      await waitForContainerReady({ containerId, accessToken, timeoutMs: 20000 });
      const storyId = await publishContainer({ igUserId, accessToken, creationId: containerId });
      console.log(`[instagram] story ${i + 1}/${frames.length} posted: ${storyId}`);
    } catch (err) {
      const message = (err as Error).message;
      const blocked = isRateLimitError(err);
      console.error(
        `[instagram] story ${i + 1} ${blocked ? "blocked by rate limit" : "failed"} (feed post still live):`,
        message
      );
      await recordServerError({
        level: "warn",
        message: `Instagram story ${i + 1} ${blocked ? "rate-limited" : "failed"}: ${message}`.slice(0, 512),
        route: "instagram/story",
      }).catch(() => {});
      // A rate-limit/integrity block won't clear within this run — stop here
      // rather than pushing more frames into the same block.
      if (blocked) break;
    } finally {
      uuids.forEach(removeTempImage);
    }
  }
}

export async function postDailyCarousel(
  stories: DailyFeedItem[],
  siteUrl: string,
  opts: {
    /** Cover variant for the grid thumbnail (alternated for the checkerboard). */
    variant?: CardVariant;
    /** Market metrics for the cover's lower-third strip, already value+unit formatted. */
    metrics?: Array<{ label: string; value: string }>;
    /**
     * "daily" = the AU/Property partner briefing (default): say-this hooks,
     * lines persisted to the feed item. "coverage" = the midday Tech/Business/
     * Global carousel: same card format, but no say-this and nothing persisted
     * (coverage stories stay headline + summary on the website).
     */
    mode?: "daily" | "coverage";
  } = {}
): Promise<{ postId: string; headline: string }> {
  const isCoverage = opts.mode === "coverage";
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  // Coverage carousel gets its own cover title + card labels so it reads as a
  // distinct series on the grid, not another "Today's Briefing".
  const coverOpts = isCoverage
    ? { title: "The Wider Lens", kicker: "Wider Lens" }
    : {};
  const cardOpts = isCoverage ? { subtextLabel: "In Brief" } : {};
  const verticalOpts = isCoverage
    ? { subtextLabel: "In Brief", header: "Wider Lens" }
    : {};

  // Over-select a candidate pool, then generate slide content across it so we
  // can exclude any story the model declines to write a why-it-matters for. A
  // SKIP (null why-it-matters) means the story is off-topic for a finance brief
  // — dropping it keeps mis-filed items (e.g. crime tagged MARKETS) off the
  // carousel instead of rendering a blank card.
  const pool = pickDailyTopStories(stories, DAILY_CANDIDATE_POOL);

  if (pool.length === 0) throw new Error("No stories available for Instagram post");

  // Every slide needs subtext. The daily post generates a why-it-matters (and a
  // say-this caption hook) per story and persists both back to the feed item.
  // The coverage post instead shows each story's own publisher summary as the
  // card subtext — in memory, nothing persisted: coverage carries no partner
  // angle, and the finance "why it matters" generator SKIPs general news, which
  // was thinning the carousel below three slides. The label is overridden to
  // "In Brief" on the card so the summary isn't mislabelled.
  if (isCoverage) {
    for (const s of pool) {
      if (!s.whyItMatters || !s.whyItMatters.trim()) {
        // Use the publisher summary as subtext only when it's real prose — not
        // a title echo or extraction garbage (same guard the website cards use).
        // A story that fails drops out of the carousel via the filter below.
        if (shouldShowSummary(s.title, s.summary)) s.whyItMatters = s.summary;
      }
    }
  } else {
    await ensureSlideContent(pool);
  }

  // Best slides that earned subtext. A thin day posts fewer real slides rather
  // than padding with blanks; an entirely off-topic pool throws.
  const withContext = pool.filter((s) => s.whyItMatters && s.whyItMatters.trim());
  const top = pickDailyTopStories(withContext, DAILY_SLIDE_COUNT);
  if (top.length === 0) throw new Error("No stories with usable context for Instagram post");

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
  const carouselUuids: string[] = [];
  // alt_text per slide, kept in lockstep with the carousel images (cover + one per story).
  const altTexts: (string | undefined)[] = [];
  try {
    // Slide 1 is a branded cover (date + numbered contents). Instagram shows
    // slide 1 as the grid thumbnail, so leading with this makes the profile
    // read as a cohesive column of covers rather than dense, unrelated tiles.
    const coverBuf = await renderDailyCoverCard(
      sanitized,
      sanitized[0]?.feedDate,
      opts.variant ?? "navy",
      opts.metrics,
      coverOpts
    );
    carouselUuids.push(storeTempImage(coverBuf));
    altTexts.push(isCoverage ? "The Desk wider lens cover" : "The Desk daily briefing cover");

    for (let i = 0; i < sanitized.length; i++) {
      // Whole carousel shares the cover's variant so a light post reads as
      // one piece when swiped, not a light cover over navy slides.
      const buf = await renderDailyStoryCard(
        sanitized[i]!,
        i,
        sanitized.length,
        opts.variant ?? "navy",
        cardOpts
      );
      carouselUuids.push(storeTempImage(buf));
      altTexts.push(sanitized[i]?.title);
    }

    const caption = isCoverage
      ? buildCoverageCaption(sanitized)
      : buildDailyCaption(sanitized);

    // Create child containers in parallel — Instagram fetches each image URL.
    // alt_text per slide is the cover/story headline (accessibility + ranking).
    const childIds = await Promise.all(
      carouselUuids.map((uuid, i) =>
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
    // The carousel parent only reports FINISHED once Instagram has fetched and
    // processed every child image. Publishing before then returns code 9007
    // ("media not ready"), so wait for readiness first — a multi-image carousel
    // can take longer to process than a single image.
    await waitForContainerReady({ containerId: carouselId, accessToken, timeoutMs: 90000 });
    const postId = await publishContainer({ igUserId, accessToken, creationId: carouselId });

    console.log(`[instagram] daily carousel posted: ${postId}`);

    // Share each story to the 24h Story IN THE BACKGROUND. The carousel is
    // already live and recorded by the caller; a slow/failing Stories API must
    // never hang this request or make the post look failed.
    void postStoryFrames({
      stories: sanitized,
      variant: opts.variant ?? "navy",
      verticalOpts,
      siteUrl,
      igUserId,
      accessToken,
    });

    return { postId, headline: sanitized[0]!.title };
  } finally {
    carouselUuids.forEach(removeTempImage);
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
    // Wait until the carousel parent is FINISHED before publishing; otherwise
    // Instagram returns code 9007 ("media not ready"). See the daily path.
    await waitForContainerReady({ containerId: carouselId, accessToken, timeoutMs: 90000 });
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
