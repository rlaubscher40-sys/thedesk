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
import { generateCoverageBrief } from "../prompts/coverageBrief";
import { generateInstagramHeadline } from "../prompts/instagramHeadline";
import { generateSayThis } from "../prompts/sayThis";
import { generateWhyItMatters } from "../prompts/whyItMatters";
import { renderPropertyDailyCover } from "./dailyCover";
import {
  type CardVariant,
  renderDailyCoverCard,
  renderDailyStoryCard,
  renderDailyStoryVertical,
  renderStatCard,
  renderWeeklyCoverCard,
  renderWeeklyStoryVertical,
  renderWeeklyTopicCard,
} from "../og/instagramCards";
import {
  createCarouselContainer,
  createImageContainer,
  createReelContainer,
  createStoryContainer,
  findRecentMedia,
  isRateLimitError,
  publishContainer,
  waitForContainerReady,
} from "./api";
import { removeTempImage, storeTempImage } from "./tempStore";
import type { ScriptLine } from "../video/narration";
import { renderStatReel } from "../video/statReel";
import { pickPropertyStories, propertyComparisonCta } from "./propertyEditorial";

export const pickDailyTopStories = pickPropertyStories;

/** Single source of truth for dash sanitization in Instagram content. */
export function sanitizeDashes(text: string): string {
  return text.replace(/[–—]/g, ", ");
}

/**
 * Instagram integrity cooldown — applies to 24h Stories only.
 *
 * The feed posts (the morning briefing carousel and The Number) publish fine
 * and stay on. Stories are the part that (a) doesn't reliably land and (b) adds
 * extra publish actions on top of them, which is what pushes the account's
 * "Application request limit reached" response on the carousel publish. So while
 * the account is flagged we skip Stories to lighten the daily load, and let the
 * flag age out. Carousels are unaffected (and guarded separately by
 * publish-verification, so a rate-limit response that still published is
 * recorded as the success it is). Self-resuming on the date — set to a past date
 * (or null) to bring Stories back immediately.
 */
export const INSTAGRAM_RESUME_DATE: string | null = null;

/** True while 24h Stories are paused for the integrity cooldown. */
export function instagramCooldownActive(): boolean {
  if (!INSTAGRAM_RESUME_DATE) return false;
  // Calendar-date compare (UTC YYYY-MM-DD) — a multi-day pause doesn't need
  // timezone precision, just "are we past the resume day yet".
  return new Date().toISOString().slice(0, 10) < INSTAGRAM_RESUME_DATE;
}

/**
 * Publish a ready carousel, tolerant of Instagram's "publishes the post but
 * still returns a rate-limit 403" behaviour. On a rate-limit/integrity error we
 * don't immediately fail: the post has often gone live anyway (confirmed on the
 * grid), so we wait a beat and check the account's newest media. If a post
 * landed in the last couple of minutes it's ours — return its id as the success
 * it actually is, instead of logging a false failure and 502-ing the run. If
 * nothing landed, it was a genuine block and we rethrow. publishContainer itself
 * is never retried (not idempotent); we only *read* to confirm the outcome.
 */
async function publishCarouselConfirmed(opts: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  try {
    return await publishContainer(opts);
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    await new Promise((r) => setTimeout(r, 6000));
    const landed = await findRecentMedia({
      igUserId: opts.igUserId,
      accessToken: opts.accessToken,
      withinMs: 180000,
    }).catch(() => null);
    if (landed) {
      console.warn(
        `[instagram] publish returned a rate-limit response but the post landed (${landed}); recording as success.`
      );
      return landed;
    }
    throw err;
  }
}

/**
 * How recently a post must have landed for a RETRY to treat it as "this run
 * already went out". The scheduler re-attempts a failed job on its next tick
 * (5 minutes), so ~25 minutes covers a couple of ticks. The scheduled posting
 * streams use separated slots from shared/instagramSchedule. Manual or
 * out-of-band posts can still make this legacy time-based recovery ambiguous.
 */
const RETRY_DUPLICATE_WINDOW_MS = 25 * 60 * 1000;

/**
 * Did the PREVIOUS attempt of this job actually publish before it reported
 * failure? Instagram can accept a publish and still fail the response (a
 * timeout, or the rate-limit-403-that-published), which leaves the run marked
 * failed with a live post on the grid — so a blind re-attempt would double-post.
 * Returns the existing media id when one landed inside the window, else null.
 *
 * This is what makes it safe for the scheduler to give the posting jobs a
 * second attempt at all: before this guard, `maxAttempts: 1` was the only
 * defence against a duplicate, which meant one transient Graph API 500 cost the
 * whole day's post.
 *
 * Only ever consults the API for attempt > 1 — on a first attempt the newest
 * media is simply the previous run's (or a hand-made) post, and skipping on it
 * would silently drop the day. Best-effort: a read failure returns null and the
 * post proceeds, because a missed post is the worse outcome of the two.
 */
export async function findAlreadyPublished(attempt: number): Promise<string | null> {
  if (attempt <= 1) return null;
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) return null;
  const landed = await findRecentMedia({
    igUserId,
    accessToken,
    withinMs: RETRY_DUPLICATE_WINDOW_MS,
  }).catch(() => null);
  if (landed) {
    console.warn(
      `[instagram] attempt ${attempt}: a post already landed (${landed}) — the previous attempt published before it failed, not posting again.`
    );
  }
  return landed;
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
const CORE_HASHTAGS = "#AustralianProperty #AusProperty #TheDesk";

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

/** Shown when the lead story has no say-this to open with. Generic by
 *  necessity, so it is a fallback rather than the default. */
const DAILY_CAPTION_FALLBACK_HOOK =
  "Today's Australian property briefing: what changed, and what the sources show.";

/**
 * The caption opens with the day's own hook, carries the conversational "say
 * this" line for each remaining slide in swipe order, then gives one useful reason
 * to save it. No particular interaction is treated as a guaranteed ranking signal. The analytical why-it-matters stays on the cards so the caption
 * doesn't repeat them.
 *
 * The opening line matters more than its length suggests: the first ~125
 * characters are all Instagram shows before "…more", so they are the entire
 * pitch to someone deciding whether to stop. A fixed sentence spends that
 * budget saying the same thing every day, which is the same weakness a
 * contents-page cover has — nothing about it is specific to today. So the lead
 * story's say-this is promoted to the top and dropped from the rundown below,
 * said once, where it does the most work.
 */
export function buildDailyCaption(stories: DailyFeedItem[]): string {
  const leadHook = stories[0]?.sayThis?.trim()
    ? sanitizeDashes(stories[0]!.sayThis!.trim()).slice(0, 200)
    : DAILY_CAPTION_FALLBACK_HOOK;

  const rundown = stories.flatMap((s, i) => {
    const headline = sanitizeDashes(s.title).slice(0, 120);
    const lines = [`${i + 1}. ${headline}`];
    // Slide 1's say-this is already the opening hook, so it is not repeated.
    if (s.sayThis && !(i === 0 && leadHook !== DAILY_CAPTION_FALLBACK_HOOK)) {
      lines.push(sanitizeDashes(s.sayThis).slice(0, 220));
    }
    lines.push("");
    return lines;
  });

  const tags = `${CORE_HASHTAGS} ${categoryHashtag(stories[0]?.category)}`;

  return [
    leadHook,
    "",
    ...rundown,
    "Save this briefing to revisit the evidence before your next property decision.",
    "",
    propertyComparisonCta("carousel"),
    "",
    tags,
  ].join("\n");
}

/**
 * Caption for the "Wider Lens" coverage carousel (Tech & Science, Business,
 * Global), now a hand-fired post rather than a scheduled one. Same shape as the
 * daily caption, but no per-story say-this
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
 *
 * satori's image decoder only understands PNG and JPEG. Our hero generator
 * (server/core/image.ts) prefers WebP for size, so a WebP hero handed to
 * satori as a backgroundImage throws "u is not iterable" deep in the layout
 * pass — which is exactly what was silently killing the weekly Instagram
 * post every Sunday (the daily cards don't use this hero, so they were
 * unaffected). Transcode anything that isn't already PNG/JPEG to JPEG here so
 * the renderers always receive a format satori can decode.
 */
export async function loadEditionHeroDataUri(editionId: number): Promise<string | null> {
  try {
    const asset = await getLatestEditionAsset(editionId, "hero");
    if (!asset?.bytes?.length) return null;
    const satoriSafe = asset.contentType === "image/png" || asset.contentType === "image/jpeg";
    if (satoriSafe) {
      return `data:${asset.contentType};base64,${asset.bytes.toString("base64")}`;
    }
    // WebP / AVIF / SVG / anything else → JPEG, the format satori can embed.
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(asset.bytes).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
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
 * Keep category variety for the manually requested Wider Lens carousel.
 * The daily property briefing uses pickPropertyStories instead.
 */
export function pickCoverageTopStories(
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
 * How many of the carousel's stories also get a 24h Story frame. Set to THREE
 * (the carousel's top stories) so the Story tray mirrors the post.
 *
 * The thing that trips Instagram's "Action is blocked" integrity limit is the
 * BURST, not the count — so these are never published together. The loop below
 * posts one frame, waits a generous beat, posts the next, waits again, and
 * bails out entirely the moment a publish comes back rate-limited (so a block
 * can never snowball into a retry storm). All of it runs in the background, so
 * the waiting is free. If the account ever gets flagged again, drop this back
 * to 1 rather than removing the spacing.
 */
const STORY_FRAME_COUNT = 3;

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
  if (instagramCooldownActive()) {
    console.log(`[instagram] Stories skipped — integrity cooldown until ${INSTAGRAM_RESUME_DATE}.`);
    return;
  }
  const { stories, variant, verticalOpts, siteUrl, igUserId, accessToken } = opts;
  const frames = stories.slice(0, STORY_FRAME_COUNT);
  // Let the account breathe well clear of the carousel publish before touching
  // the API again — a generous gap is the single biggest lever against the
  // "Action is blocked" integrity flag, and this is background work so the wait
  // costs nothing. Each subsequent frame is spaced out by the same logic; the
  // gap was widened (20s -> 45s) when the count went from 1 to 3 so three
  // publishes never read as a burst.
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await settle(45000);
  for (let i = 0; i < frames.length; i++) {
    if (i > 0) await settle(45000);
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
        message:
          `Instagram story ${i + 1} ${blocked ? "rate-limited" : "failed"}: ${message}`.slice(
            0,
            512
          ),
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
     * lines persisted to the feed item. "coverage" = the hand-fired Tech/
     * Business/Global carousel: same card format, but no say-this and nothing persisted
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
  // Coverage slides carry an "In Brief" paraphrase rather than a partner
  // why-it-matters, so its swipe promise has to name that instead.
  const coverOpts = isCoverage
    ? { title: "The Wider Lens", kicker: "Wider Lens", swipe: "Swipe for the full rundown »" }
    : {};
  const cardOpts = isCoverage ? { subtextLabel: "In Brief" } : {};
  const verticalOpts = isCoverage ? { subtextLabel: "In Brief", header: "Wider Lens" } : {};

  // Over-select a candidate pool, then generate slide content across it so we
  // can exclude any story the model declines to write a why-it-matters for. A
  // SKIP (null why-it-matters) means the story is off-topic for a finance brief
  // — dropping it keeps mis-filed items (e.g. crime tagged MARKETS) off the
  // carousel instead of rendering a blank card.
  const selectStories = isCoverage ? pickCoverageTopStories : pickDailyTopStories;
  const pool = selectStories(stories, DAILY_CANDIDATE_POOL);

  if (pool.length === 0) throw new Error("No stories available for Instagram post");

  // Every slide needs subtext. The daily post generates a why-it-matters (and a
  // say-this caption hook) per story and persists both back to the feed item.
  // The coverage post generates an original one-line "In Brief" instead — in
  // memory, nothing persisted: coverage carries no partner angle, and the
  // finance "why it matters" generator SKIPs general news, which was thinning
  // the carousel below three slides. We generate our own paraphrase rather than
  // reprint the publisher's summary verbatim (that would republish uncleared
  // source copy). A story whose brief fails drops out via the filter below.
  if (isCoverage) {
    await Promise.all(
      pool.map(async (s, i) => {
        if (s.whyItMatters && s.whyItMatters.trim()) return;
        const brief = await generateCoverageBrief({
          title: s.title,
          summary: s.summary,
          category: s.category,
        });
        if (brief) pool[i] = { ...pool[i]!, whyItMatters: brief };
      })
    );
  } else {
    await ensureSlideContent(pool);
  }

  // Best slides that earned subtext. A thin day posts fewer real slides rather
  // than padding with blanks; an entirely off-topic pool throws.
  const withContext = pool.filter((s) => s.whyItMatters && s.whyItMatters.trim());
  const top = selectStories(withContext, DAILY_SLIDE_COUNT);
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
    // Coverage keeps its branded series cover. The morning briefing earns the
    // grid tile with the actual lead hook: the source-backed claim is the first
    // thing a scroller sees, while supporting stories and live metrics remain
    // visible as proof/context lower on the card.
    const coverBuf = isCoverage
      ? await renderDailyCoverCard(
          sanitized,
          sanitized[0]?.feedDate,
          opts.variant ?? "navy",
          opts.metrics,
          coverOpts
        )
      : await renderPropertyDailyCover(sanitized, opts.variant ?? "navy", opts.metrics);
    carouselUuids.push(storeTempImage(coverBuf));
    altTexts.push(isCoverage ? "The Desk wider lens cover" : sanitized[0]!.title);

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

    const caption = isCoverage ? buildCoverageCaption(sanitized) : buildDailyCaption(sanitized);

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
    const postId = await publishCarouselConfirmed({
      igUserId,
      accessToken,
      creationId: carouselId,
    });

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
  siteUrl: string,
  variant: CardVariant = "navy"
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
    // Slide 1: cover, tone set by the running checkerboard parity.
    uuids.push(storeTempImage(await renderWeeklyCoverCard(sanitizedEdition, heroDataUri, variant)));

    // Slides 2–N: one per topic
    for (let i = 0; i < sanitizedTopics.length; i++) {
      const buf = await renderWeeklyTopicCard(sanitizedTopics[i]!, i + 1, totalSlides, variant);
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
    const postId = await publishCarouselConfirmed({
      igUserId,
      accessToken,
      creationId: carouselId,
    });

    console.log(`[instagram] weekly edition ${edition.editionNumber} posted: ${postId}`);

    // Share the edition to the 24h Story. Best-effort: a Story failure must
    // never fail the feed post that has already gone live. Skipped entirely
    // while Stories are paused for the integrity cooldown.
    if (!instagramCooldownActive())
      try {
        const storyBuf = await renderWeeklyStoryVertical(sanitizedEdition, heroDataUri, variant);
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

/**
 * Caption for the stat post.
 *
 * The first ~125 characters are all Instagram shows before "…more", so the
 * sentence leads and the sourced claim follows immediately — a reader who never
 * expands still gets the whole point. Names a reader who may find it useful
 * and names the source,
 * because a number nobody can check is worth nothing on this format.
 */
export function buildStatCaption(stat: {
  label: string;
  value: string;
  line: string;
  subtext: string;
  source?: string | null;
}): string {
  const claim = sanitizeDashes(stat.subtext);
  // The subtext renders uppercase on the card for the typography; in the
  // caption that would read as shouting, so sentence-case it here.
  const claimSentence = claim.charAt(0) + claim.slice(1).toLowerCase();

  return [
    `${sanitizeDashes(stat.label)}: ${sanitizeDashes(stat.value)}.`,
    "",
    sanitizeDashes(stat.line),
    "",
    `${claimSentence}.`,
    stat.source ? `Source: ${sanitizeDashes(stat.source)}.` : "",
    "",
    "Share this with someone comparing Australian property markets.",
    "",
    propertyComparisonCta("stat"),
    "",
    `${CORE_HASHTAGS} #PropertyData`,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}

/**
 * Publish one stat card as a single-image post.
 *
 * Single image rather than a carousel on purpose: the format's whole argument
 * is that one number, stated plainly, travels further than a contents page of
 * three. There is nothing to swipe to, and adding filler slides to fill a
 * carousel would undo the point.
 *
 * Returns the media id and the value posted, for the caller to record.
 */
export async function postStatCard(
  stat: {
    label: string;
    value: string;
    line: string;
    subtext: string;
    source?: string | null;
    asOf?: Date | null;
  },
  siteUrl: string,
  opts: { variant?: CardVariant } = {}
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  const sanitized = {
    ...stat,
    label: sanitizeDashes(stat.label),
    value: sanitizeDashes(stat.value),
    line: sanitizeDashes(stat.line),
    subtext: sanitizeDashes(stat.subtext),
  };

  let uuid: string | null = null;
  try {
    const buf = await renderStatCard(sanitized, opts.variant ?? "navy");
    uuid = storeTempImage(buf);

    const containerId = await createImageContainer({
      igUserId,
      accessToken,
      imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
      caption: buildStatCaption(sanitized),
      altText: `${sanitized.label}: ${sanitized.value}. ${sanitized.line}`,
    });
    await waitForContainerReady({ containerId, accessToken, timeoutMs: 60000 });
    const postId = await publishCarouselConfirmed({
      igUserId,
      accessToken,
      creationId: containerId,
    });

    console.log(`[instagram] stat card posted: ${postId} (${sanitized.label} ${sanitized.value})`);
    return { postId, headline: `${sanitized.label}: ${sanitized.value}` };
  } finally {
    if (uuid) removeTempImage(uuid);
  }
}

/** Slides in the monthly carousel: the lead number plus the next few movers.
 *  Four keeps it swipeable without padding it out with ordinary months. */
const MONTHLY_SLIDE_COUNT = 4;

/**
 * Caption for the monthly review.
 *
 * Leads with the reading, which is already the sharpest sentence available and
 * is specific to this month rather than a fixed opener. Names what the series
 * is, because the whole point of a franchise is that a reader learns to expect
 * it, and says where the numbers come from, because "our own history" is the
 * claim that makes this series worth following rather than another recap.
 */
export function buildMonthlyCaption(
  review: { label: string; reading: string },
  movers: Array<{ label: string; move: string; claim: string }>
): string {
  const rundown = movers.flatMap((m) => [
    `${sanitizeDashes(m.label)}: ${sanitizeDashes(m.move)} (${sanitizeDashes(m.claim.toLowerCase())})`,
  ]);

  return [
    sanitizeDashes(review.reading),
    "",
    `The Month in Numbers, ${sanitizeDashes(review.label)}.`,
    "",
    ...rundown,
    "",
    // The honest description of the method, and the reason to follow: we are
    // the only ones who can rank these against each other.
    "Every move is measured against what that number normally does in a month, from our own daily records. A big percentage in a jumpy series is not news; a small one in a still series is.",
    "",
    "Which of these actually changed your thinking? Tell us below.",
    "Save this, it is the month in one place.",
    "",
    "The full month, every number, is in our bio.",
    "",
    `${CORE_HASHTAGS} #PropertyData`,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}

/**
 * Publish the monthly review as a carousel.
 *
 * A carousel rather than a single image because a month genuinely has several
 * numbers in it, and slide 1 leads with the biggest one rather than a contents
 * page — the grid thumbnail is a number, which is the whole argument of this
 * account's better format. The swipe prompt names what the later slides hold
 * so the loop is real rather than decorative.
 */
export async function postMonthlyReview(
  cards: Array<{
    label: string;
    value: string;
    line: string;
    subtext: string;
    source?: string | null;
    asOf?: Date | null;
  }>,
  review: { label: string; reading: string },
  siteUrl: string,
  opts: { variant?: CardVariant } = {}
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }
  if (cards.length === 0) throw new Error("No movers to post for the monthly review");

  const slides = cards.slice(0, MONTHLY_SLIDE_COUNT).map((c) => ({
    ...c,
    label: sanitizeDashes(c.label),
    value: sanitizeDashes(c.value),
    line: sanitizeDashes(c.line),
    subtext: sanitizeDashes(c.subtext),
  }));

  const uuids: string[] = [];
  try {
    for (let i = 0; i < slides.length; i++) {
      const buf = await renderStatCard(slides[i]!, opts.variant ?? "navy", {
        // Slide 1 names the series; the rest count so a swiper knows where
        // they are in it.
        kicker: i === 0 ? `The Month in Numbers` : `${i + 1} / ${slides.length}`,
      });
      uuids.push(storeTempImage(buf));
    }

    const childIds = await Promise.all(
      uuids.map((uuid, i) =>
        createImageContainer({
          igUserId,
          accessToken,
          imageUrl: `${siteUrl}/instagram/temp/${uuid}.jpg`,
          altText: `${slides[i]!.label}: ${slides[i]!.value}. ${slides[i]!.line}`,
          isCarouselItem: true,
        })
      )
    );

    const carouselId = await createCarouselContainer({
      igUserId,
      accessToken,
      childrenIds: childIds,
      caption: buildMonthlyCaption(
        review,
        slides.map((s) => ({ label: s.label, move: s.value, claim: s.subtext }))
      ),
    });
    await waitForContainerReady({ containerId: carouselId, accessToken, timeoutMs: 90000 });
    const postId = await publishCarouselConfirmed({
      igUserId,
      accessToken,
      creationId: carouselId,
    });

    console.log(`[instagram] monthly review posted: ${postId} (${review.label})`);
    return { postId, headline: `The Month in Numbers: ${review.label}` };
  } finally {
    uuids.forEach(removeTempImage);
  }
}

/**
 * Caption for a Reel.
 *
 * Shorter than a feed caption on purpose. Reels are watched, not read: the clip
 * carries the number, the sentence and the claim, so repeating them here wastes
 * the one line that shows before "…more". It names the series, asks for the
 * save, and gets out of the way.
 */
export function buildReelCaption(stat: {
  label: string;
  value: string;
  line: string;
  subtext: string;
  source?: string | null;
}): string {
  return [
    sanitizeDashes(stat.line),
    "",
    `${sanitizeDashes(stat.label)}: ${sanitizeDashes(stat.value)}.`,
    `${sanitizeDashes(stat.subtext.charAt(0) + stat.subtext.slice(1).toLowerCase())}.`,
    "",
    "Measured against the recorded readings we hold, not an all-time history.",
    stat.source ? `Source: ${sanitizeDashes(stat.source)}.` : "",
    "",
    propertyComparisonCta("reel"),
    "",
    `${CORE_HASHTAGS} #PropertyData`,
  ].join("\n");
}

/**
 * How long the Reel's container may be waited on, given when this call has to
 * be finished.
 *
 * Reels are transcoded server-side and that genuinely can take minutes, which
 * is why the wait was a flat five. But the scheduler drives this over
 * `fetch`, and Node aborts a request whose headers have not arrived in 300
 * seconds — measured, not assumed. Rendering takes seventy to ninety of those,
 * so a flat five-minute wait on top could put the response past the point the
 * scheduler is still listening: the post lands, the run is recorded as failed,
 * an alert goes out, and the retry has to be caught by `findAlreadyPublished`.
 * No double post, but a false alarm and a confusing log every time.
 *
 * So the wait gets the time that is actually left. The floor exists because a
 * wait of a few seconds is not worth attempting at all — better to fail
 * cleanly and let the retry, which starts with a fresh budget, have a real go.
 */
export const MIN_CONTAINER_WAIT_MS = 60_000;
export const MAX_CONTAINER_WAIT_MS = 300_000;

export function containerWaitBudgetMs(deadlineAt: number | undefined, now = Date.now()): number {
  if (!deadlineAt) return MAX_CONTAINER_WAIT_MS;
  const left = deadlineAt - now;
  return Math.min(MAX_CONTAINER_WAIT_MS, Math.max(MIN_CONTAINER_WAIT_MS, left));
}

/**
 * Publish a stat card as a Reel.
 *
 * Reels are the only surface on Instagram that reliably reaches people who do
 * not already follow the account, so this is the first thing here aimed at
 * growth rather than at the people already reading.
 *
 * The video and its cover are both served from the temp store while Instagram
 * fetches them. The cover is the fully-revealed frame rather than the opening
 * one: the grid thumbnail should show the finished card, not an empty stage.
 */
export async function postStatReel(
  stat: {
    label: string;
    value: string;
    line: string;
    subtext: string;
    source?: string | null;
    asOf?: Date | null;
    /** The metric's own readings, oldest first. Drawn as a line under the
     *  claim, and animated across the clip. Omitted, the Reel is the card
     *  without its history — which still posts, just with less behind it. */
    series?: { value: number; at: Date }[];
    /** Supporting figures, printed under the claim and revealed one at a time.
     *  This is the density lever; see `buildStatFacts`. */
    facts?: { figure: string; caption: string }[];
  },
  siteUrl: string,
  opts: {
    variant?: CardVariant;
    script?: ScriptLine[];
    subtitles?: boolean;
    caption?: string;
    publication?: { key: string; date: string };
    /**
     * Epoch ms by which this call must have returned. The caller is answering
     * an HTTP request with a hard ceiling on it, and the render is the variable
     * part, so the wait for Instagram's transcode is given whatever is left
     * rather than a fixed five minutes on top of an unknown.
     */
    deadlineAt?: number;
  } = {}
): Promise<{ postId: string; headline: string }> {
  const { instagramAccessToken: accessToken, instagramBusinessAccountId: igUserId } = env;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set");
  }

  if (!opts.publication)
    throw new Error("A durable evidence reservation is required for Reel publication.");
  const publication = opts.publication;
  const { fetchPublishingLimit } = await import("./api");
  const quota = await fetchPublishingLimit({ accessToken, igUserId });
  if (quota.usage == null || quota.quota == null || quota.usage >= quota.quota)
    throw new Error("Publishing quota is unavailable or exhausted. No Reel was sent.");

  const sanitized = {
    ...stat,
    label: sanitizeDashes(stat.label),
    value: sanitizeDashes(stat.value),
    line: sanitizeDashes(stat.line),
    subtext: sanitizeDashes(stat.subtext),
  };
  const variant = opts.variant ?? "navy";

  let videoUuid: string | null = null;
  let coverUuid: string | null = null;
  const renderStartedAt = Date.now();
  try {
    const [video, cover] = await Promise.all([
      renderStatReel(sanitized, variant, { script: opts.script, subtitles: opts.subtitles }),
      renderStatCard(sanitized, variant, {
        shape: "vertical",
        kicker: "The Number",
        facts: sanitized.facts,
      }),
    ]);
    console.log(
      `[instagram] reel rendered in ${((Date.now() - renderStartedAt) / 1000).toFixed(1)}s ` +
        `(${(video.bytes.length / 1e6).toFixed(2)}MB, ${video.seconds.toFixed(1)}s, ` +
        `${video.narrated ? "narrated" : "SILENT"})`
    );
    if (!video.narrated) throw new Error("Narration unavailable. No silent Reel was published.");
    if (opts.subtitles && !video.subtitled)
      throw new Error("Required Reel subtitles are unavailable. No Reel was published.");
    videoUuid = storeTempImage(video.bytes, "video/mp4");
    coverUuid = storeTempImage(cover);

    const containerId = await createReelContainer({
      igUserId,
      accessToken,
      videoUrl: `${siteUrl}/instagram/temp/${videoUuid}.mp4`,
      coverUrl: `${siteUrl}/instagram/temp/${coverUuid}.jpg`,
      caption: opts.caption ?? buildReelCaption(sanitized),
    });
    // Reels are transcoded server-side, so readiness takes far longer than an
    // image container. Publishing early returns "media not ready" and burns the
    // container.
    await waitForContainerReady({
      containerId,
      accessToken,
      timeoutMs: containerWaitBudgetMs(opts.deadlineAt),
    });
    const { claimJobRun, markJobRun } = await import("../db/jobRuns");
    if (!(await claimJobRun(publication.key, publication.date, 1)))
      throw new Error(
        "This evidence is already published or locked, or its durable record is unavailable. No duplicate was sent."
      );
    let postId: string;
    try {
      // No heuristic recovery from unrelated recent posts, and no retry after
      // an uncertain non-idempotent publish response.
      const { publishContainer } = await import("./api");
      postId = await publishContainer({ igUserId, accessToken, creationId: containerId });
    } catch {
      await markJobRun(
        publication.key,
        publication.date,
        "failed",
        `Outcome unknown; inspect Meta container ${containerId}. Locked against automatic retry.`
      );
      throw new Error(
        "Meta did not confirm Reel publication. The evidence slot is locked; inspect the profile before recovery."
      );
    }
    await markJobRun(publication.key, publication.date, "success", `Published media ${postId}`);

    console.log(
      `[instagram] reel posted: ${postId} (${sanitized.label} ${sanitized.value}, ` +
        `${video.seconds.toFixed(1)}s, ${video.narrated ? "narrated" : "SILENT — tts unavailable"})`
    );
    return { postId, headline: `${sanitized.label}: ${sanitized.value}` };
  } finally {
    if (videoUuid) removeTempImage(videoUuid);
    if (coverUuid) removeTempImage(coverUuid);
  }
}
