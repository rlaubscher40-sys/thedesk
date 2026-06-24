/**
 * Two POST endpoints fired by the external scheduler:
 *
 *   POST /api/scheduled/daily-feed  , bulk ingest of daily scan items
 *   POST /api/scheduled/weekly-edition, single weekly edition payload
 *
 * Both authenticate against SCHEDULED_API_KEY (header or `?key=`), validate the
 * payload via Zod, persist what's valid, and schedule LLM enrichment in
 * setImmediate so the HTTP response returns quickly.
 */
import { timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, isEnrichedChannel } from "../shared/const";
import { defaultFeedPriority } from "../shared/feedPriority";
import { bestMatch, titleTokens } from "../shared/textSimilarity";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { invalidate } from "./core/cache";
import { env } from "./core/env";
import { routeParam } from "./core/requestParams";
import { resolveHeroForEdition } from "./core/heroSelection";
import {
  editionUnsubscribeUrl,
  nudgeResponseUrl,
  sendDailyBriefEmail,
  sendEditionNotificationEmail,
  sendTalkingPointNudgeEmail,
  sendWeeklyRecapEmail,
} from "./core/mailer";
import { sdk } from "./core/sdk";
import * as db from "./db";
import { dailyFeedIngestBodySchema, weeklyEditionIngestSchema } from "../shared/schemas";
import {
  editionHeroPrompt,
  extractMetricFromNews,
  feedItemImagePrompt,
  generateDailyAngles,
  generateLookback,
  generateRubensTake,
  optimiseHeadlines,
  runEditorQc,
  synthesizeWeeklyEdition,
} from "./prompts";
import Parser from "rss-parser";

function siteOrigin(): string {
  const v = process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "https://thedesk.au";
  return v.replace(/\/+$/, "");
}

// ─── Auth ───────────────────────────────────────────────────────────────────

async function authenticateScheduled(req: Request): Promise<boolean> {
  if (env.scheduledApiKey) {
    const headerKey = req.headers["x-scheduled-key"];
    const queryKey = typeof req.query.key === "string" ? req.query.key : undefined;
    const provided = (typeof headerKey === "string" ? headerKey : undefined) ?? queryKey;
    if (
      provided &&
      provided.length === env.scheduledApiKey.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(env.scheduledApiKey))
    )
      return true;
  }
  // Fallback: an admin session cookie also unlocks the endpoint (useful for
  // local "run the cron by hand" testing).
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await sdk.verifySession(cookies[COOKIE_NAME]);
  return Boolean(session);
}

// ─── Instagram daily cover inputs (shared by the post handler + preview) ─────

/**
 * Next cover colour for the grid checkerboard: the OPPOSITE of the most recent
 * daily/coverage/weekly cover. A plain per-type rule (daily=light,
 * coverage=navy) tiled cleanly while there were only two posts a day, but the
 * weekly edition is a third cover with no alternation partner, so it landed on
 * whatever tone it pleased and broke the rhythm every week. Flipping from the
 * last recorded tone instead folds all three streams into one alternating
 * sequence, which is a clean checkerboard on the 3-wide grid regardless of
 * cadence. Falls back to "navy" to seed the pattern when nothing's recorded yet
 * (or the coverVariant column predates this change).
 */
async function nextCoverVariant(): Promise<"navy" | "light"> {
  const last = await db.latestGridCoverVariant();
  if (last === "navy") return "light";
  if (last === "light") return "navy";
  return "navy";
}

/** The morning's metrics, value+unit formatted, capped to the 4 the cover shows. */
function dailyCoverMetrics(metrics: db.DailyMetric[]): Array<{ label: string; value: string }> {
  return metrics
    .slice(0, 4)
    .map((m) => ({ label: m.label, value: m.unit ? `${m.value}${m.unit}` : m.value }));
}

// ─── Sanitisation ────────────────────────────────────────────────────────────

const replacements: Array<[RegExp, string]> = [
  [/—|–/g, "-"],
  [/‘|’/g, "'"],
  [/“|”/g, '"'],
  [/…/g, "..."],
  [/ /g, " "],
];

function sanitiseText<T extends string | null | undefined>(text: T): T {
  if (!text) return text;
  let out = text as string;
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  return out as T;
}

// ─── Daily feed ─────────────────────────────────────────────────────────────

/**
 * Run an async worker over items with at most `limit` in flight at once.
 * Used to throttle the per-item LLM enrichment so the whole feed doesn't burst
 * its calls at Anthropic in one go and trip the rate limit. Order-independent;
 * the worker keys off its own index.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i]!, i);
      }
    }
  );
  await Promise.all(runners);
}

function registerDailyFeedRoute(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = dailyFeedIngestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const items = parsed.data.items.map((item) => {
      const category = item.category.toUpperCase();
      const source = sanitiseText(item.source);
      return {
        feedDate: item.feedDate,
        title: sanitiseText(item.title),
        source,
        sourceUrl: item.sourceUrl ?? null,
        summary: sanitiseText(item.summary),
        category,
        // Content lane. Defaults to the Australian flagship when the ingest
        // doesn't tag one, so legacy/untagged payloads keep their old home.
        channel: item.channel ?? "AU",
        imageUrl: item.imageUrl ?? null,
        partnerTag: sanitiseText(item.partnerTag ?? null),
        sayThis: sanitiseText(item.sayThis ?? null),
        whyItMatters: sanitiseText(item.whyItMatters ?? null),
        // Corroboration is computed at ingest (clustering) and persisted so
        // the card can show how many outlets ran the story.
        corroborationCount: item.corroborationCount ?? 1,
        corroboratingSources: item.corroboratingSources ?? null,
        promotedToEdition: false,
        // Editorial-impact baseline. The admin can override per-item via
        // feed.setPriority, manual control always wins.
        priority: defaultFeedPriority({ category, source }),
        // Transient, used only to ground the LLM enrichment below. Stripped
        // before the DB insert (no column for it on the feed table).
        articleText: item.articleText ?? null,
      };
    });

    // Reject any story whose sourceUrl already appeared in the last 14 days.
    // This prevents re-ingesting the same article on back-to-back days when
    // an external trigger re-runs or when the same story is picked up twice.
    const [recentUrls, recentItems] = await Promise.all([
      db.getRecentSourceUrls(14),
      db.getRecentFeedItems(10),
    ]);
    const freshItemsRaw = items.filter(
      (item) => !item.sourceUrl || !recentUrls.has(item.sourceUrl)
    );
    const skippedCount = items.length - freshItemsRaw.length;
    if (skippedCount > 0) {
      console.log(
        `[daily-feed] skipped ${skippedCount} duplicate story/stories (seen in last 14 days)`
      );
    }

    // Story threading: link each fresh item to the most similar recent prior
    // item (newest first, so it threads to the latest coverage) so the card
    // can show "Continues from …". Headline-token match; null when nothing
    // clears the threshold, which is the common case for a genuinely new story.
    const threadCandidates = recentItems.map((r) => ({
      value: r,
      tokens: titleTokens(r.title),
    }));
    let threadedCount = 0;
    const freshItems = freshItemsRaw.map((item) => {
      const parent = bestMatch(titleTokens(item.title), threadCandidates);
      if (parent) threadedCount++;
      return {
        ...item,
        threadParentId: parent?.id ?? null,
        threadParentTitle: parent?.title ?? null,
      };
    });
    if (threadedCount > 0) {
      console.log(`[daily-feed] threaded ${threadedCount} story/stories to prior coverage`);
    }

    let insertedIds: number[];
    try {
      // Drop the transient articleText before persisting, the feed table has
      // no column for it. It stays available on `freshItems` for enrichment.
      insertedIds = await db.createFeedItems(
        freshItems.map(({ articleText: _drop, ...row }) => row)
      );
    } catch (err) {
      console.error("[scheduled] daily-feed insert failed:", err);
      // Surface the underlying DB error so the GitHub Actions log (the only
      // thing the operator sees) is diagnosable, rather than an opaque
      // "Database insert failed" with the real cause buried server-side.
      res.status(500).json({
        error: "Database insert failed",
        message: (err as Error).message,
      });
      return;
    }

    // New stories are live — drop the cached feed reads so today's page
    // reflects the ingest immediately rather than after the TTL.
    invalidate("feed:");

    // `insertedIds` is index-aligned with freshItems; a 0 marks a row that
    // was dropped during the row-by-row fallback, so the honest count is the
    // number of non-zero ids, not the input length.
    const insertedCount = insertedIds.filter((id) => id > 0).length;
    res.json({
      success: true,
      count: insertedCount,
      skipped: skippedCount,
      dropped: freshItems.length - insertedCount,
    });

    // ── Background: partnerTag + sayThis + per-item image enrichment ─────
    const feedDate = freshItems[0]?.feedDate;
    if (feedDate && insertedIds.length === freshItems.length) {
      setImmediate(async () => {
        try {
          let tagOk = 0;
          let sayOk = 0;
          let whyOk = 0;
          let cpOk = 0;
          let imgOk = 0;
          // Bounded concurrency: each enriched item now fires a single
          // combined LLM call, but a flat Promise.all over the whole feed
          // would still burst the per-minute ceiling on a big day. A small
          // pool keeps us under it. Items zip to their row by position:
          // createFeedItems returns IDs in input order (matching by title
          // collided when two sources ran the same headline).
          await mapWithConcurrency(freshItems, 4, async (item, index) => {
              const id = insertedIds[index];
              if (!id) return;

              // Only the partner-relevant Australian lanes (AU, PROPERTY) get
              // the expensive editorial enrichment. BUSINESS / TECH / GLOBAL
              // are coverage-only — they skip angle generation and run
              // image/dedup/threading alone (the latter two already ran
              // pre-insert above). Any preset angle the source supplied was
              // persisted at insert and is left untouched.
              const enrich = isEnrichedChannel(item.channel);

              // One combined call writes all four angles together (and edits
              // them against each other), instead of four generators plus a
              // fifth QC pass each re-sending the full article text. Same
              // editorial result, ~5x fewer calls and ~5x less input. Source-
              // supplied presets always win; the call only fills the gaps.
              let tagValue: string | null = null;
              let sayValue: string | null = null;
              let whyValue: string | null = null;
              let cpValue: string | null = null;
              if (enrich) {
                const angles = await generateDailyAngles({
                  title: item.title,
                  summary: item.summary,
                  category: item.category,
                  articleText: item.articleText,
                });
                tagValue = item.partnerTag ?? angles.partnerTag;
                sayValue = item.sayThis ?? angles.sayThis;
                whyValue = item.whyItMatters ?? angles.whyItMatters;
                cpValue = angles.counterpoint;
              }

              // Feed items don't use AI thumbnails post-refactor, they rely on
              // the og:image scraped during ingest. Wiring per-item asset
              // storage is doable (mirror the edition_assets pattern keyed on
              // feedItemId) but isn't worth the schema churn for thumbnails
              // that come free from the source URL.
              const imageUrl = item.imageUrl ?? null;

              // Persist each angle independently. The Today page now gives a
              // story a full card if it has EITHER a Say This or a Partner
              // Angle (FeedItemCard renders whichever is present), so keeping
              // a lone angle surfaces more full-size stories instead of
              // demoting them to the signals strip.
              if (tagValue) {
                await db.updateFeedItemPartnerTag(id, tagValue);
                tagOk++;
              }
              if (sayValue) {
                await db.updateFeedItemSayThis(id, sayValue);
                sayOk++;
              }
              // "Why it matters" stands alone — it's context, not a partner
              // angle, so it persists independent of the say/tag pairing.
              if (whyValue) {
                await db.updateFeedItemWhyItMatters(id, whyValue);
                whyOk++;
              }
              // Counterpoint also stands alone, present only when the story
              // had a genuine second side.
              if (cpValue) {
                await db.updateFeedItemCounterpoint(id, cpValue);
                cpOk++;
              }
              if (imageUrl) {
                await db.updateFeedItemImageUrl(id, imageUrl);
                imgOk++;
              }
            });
          console.log(
            `[scheduled] enriched ${feedDate}: ${tagOk} partnerTags, ${sayOk} sayThis, ${whyOk} whyItMatters, ${cpOk} counterpoints, ${imgOk} images`
          );
          // Enrichment mutated the rows in place — bust again so the
          // AI-generated lines replace the bare summaries readers may have
          // cached in the seconds between ingest and enrichment finishing.
          invalidate("feed:");

          // Send the daily brief after enrichment so subscribers get
          // the AI-generated context lines, not raw summaries.
          void notifyDailyBriefSubscribers(feedDate);
        } catch (err) {
          console.error("[scheduled] daily-feed enrichment error:", err);
        }
      });
    }
  };
  app.post("/api/scheduled/daily-feed", handler);
  app.post("/api/ingest/daily-feed", handler);
}

// ─── Weekly edition ─────────────────────────────────────────────────────────

function registerWeeklyEditionRoute(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = weeklyEditionIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    // Topic categories are already uppercase by way of the Zod enum.
    const edition = {
      editionNumber: body.editionNumber,
      weekOf: body.weekOf,
      weekRange: body.weekRange,
      pdfUrl: body.pdfUrl ?? `desk://edition/${body.editionNumber}`,
      readingTime: body.readingTime ?? null,
      topics: body.topics.map((t) => ({
        ...t,
        title: sanitiseText(t.title),
        summary: sanitiseText(t.summary),
        body: sanitiseText(t.body),
        keyTakeaway: sanitiseText(t.keyTakeaway),
      })),
      signals: body.signals.map((s) =>
        typeof s === "string" ? sanitiseText(s) : { ...s, text: sanitiseText(s.text) }
      ),
      fullText: sanitiseText(body.fullText ?? null),
      keyMetrics: body.keyMetrics ?? null,
    };

    try {
      await db.createEdition(edition);
    } catch (err) {
      console.error("[scheduled] weekly-edition insert failed:", err);
      res.status(500).json({ error: "Database insert failed" });
      return;
    }

    console.log(`[scheduled] ingested Edition ${edition.editionNumber}: ${edition.weekOf}`);
    invalidate("edition:");
    res.json({ success: true, editionNumber: edition.editionNumber });

    // ── Background: hero image + Ruben's Take ──────────────────────────────
    setImmediate(async () => {
      const inserted = await db.getEditionByNumber(edition.editionNumber);
      if (!inserted) return;

      // Hero image and take are independent, run them in parallel.
      // Hero defaults to the library (zero OpenAI cost when there's an
      // image to reuse). Falls back to fresh generation if the library
      // is empty, and seeds the library on that fallback so future
      // editions can reuse it.
      const [imageResult, takeResult] = await Promise.allSettled([
        resolveHeroForEdition({
          editionId: inserted.id,
          prompt: editionHeroPrompt({
            weekRange: edition.weekRange,
            topics: edition.topics,
          }),
        }),
        generateRubensTake({
          weekRange: edition.weekRange,
          topics: edition.topics,
          keyMetrics: edition.keyMetrics,
        }),
      ]);

      if (imageResult.status === "rejected") {
        console.warn(`[scheduled] hero image failed:`, imageResult.reason);
      } else if (imageResult.value.ok) {
        await db.updateHeroImage(inserted.id, db.editionAssetUrl(inserted.id, "hero"));
        console.log(
          `[scheduled] hero image set for Edition ${edition.editionNumber} (source: ${imageResult.value.source})`
        );
      } else {
        console.warn(
          `[scheduled] hero image unavailable for Edition ${edition.editionNumber}:`,
          imageResult.value.reason
        );
      }

      if (takeResult.status === "fulfilled") {
        await db.updateRubensTake(inserted.id, takeResult.value);
        console.log(`[scheduled] Ruben's Take generated for Edition ${edition.editionNumber}`);
      } else {
        console.warn(`[scheduled] Ruben's Take failed:`, takeResult.reason);
      }

      // Hero + take landed — bust so the reader shows the finished edition.
      invalidate("edition:");

      // Notify subscribers now that enrichment is complete so the email
      // links to a fully-rendered edition (hero image + take in place).
      void notifySubscribers(edition.editionNumber, edition.weekRange);
    });
  };
  app.post("/api/scheduled/weekly-edition", handler);
  app.post("/api/ingest/weekly-edition", handler);
}

// ─── Weekly edition synthesis from feed ─────────────────────────────────────

const synthesizeEditionBodySchema = z.object({
  /** ISO date (YYYY-MM-DD) of any day in the target week. Defaults to today. */
  anyDateInWeek: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional(),
});

/**
 * Returns the Monday and Sunday of the ISO week containing `iso` as
 * "YYYY-MM-DD" strings. Used to bound the feed-items query and to label
 * the new edition.
 */
function isoWeekBounds(iso: string): {
  weekStart: string;
  weekEnd: string;
  weekRange: string;
  weekOf: string;
} {
  const d = new Date(iso + "T12:00:00Z");
  // Monday = 1, Sunday = 0 → shift Sunday to 7 then back-compute Monday.
  const dayNum = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const monthDay = (date: Date) =>
    date.toLocaleString("en-AU", { month: "short", day: "numeric", timeZone: "UTC" });
  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
    weekRange: `${monthDay(monday)} - ${monthDay(sunday)}, ${sunday.getUTCFullYear()}`,
    weekOf: fmt(monday),
  };
}

function registerSynthesizeEditionRoute(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = synthesizeEditionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }

    const target = parsed.data.anyDateInWeek ?? new Date().toISOString().slice(0, 10);
    const { weekStart, weekEnd, weekRange, weekOf } = isoWeekBounds(target);

    // The weekly edition is the partner deep-dive: synthesise from the
    // enriched lanes (AU + Property) only. Coverage-lane headlines (Business /
    // Tech / Global) live on the Today tabs, not in the edition.
    const items = (await db.listFeedItemsBetween(weekStart, weekEnd)).filter((it) =>
      isEnrichedChannel(it.channel)
    );
    if (items.length === 0) {
      res.status(422).json({
        error: "No feed items in target week",
        weekStart,
        weekEnd,
      });
      return;
    }

    // Refuse to overwrite, if an edition already exists for this week, bail
    // out and let the caller decide what to do.
    const existing = await db.listEditions();
    const dup = existing.find((e) => e.weekOf === weekOf);
    if (dup) {
      res.status(409).json({
        error: "Edition already exists for this week",
        editionNumber: dup.editionNumber,
        weekOf: dup.weekOf,
      });
      return;
    }

    // Pull the verified metrics store (RBA / ABS / market feeds / sourced
    // extraction) so synthesis grounds its numbers in real data instead of
    // reconstructing them from RSS snippets and stale model memory.
    const verifiedMetrics = (await db.listDailyMetrics()).map((m) => ({
      metricKey: m.metricKey,
      label: m.label,
      value: m.value,
      unit: m.unit,
      context: m.context,
      source: m.source,
      asOf: m.asOf,
    }));

    let synth;
    try {
      synth = await synthesizeWeeklyEdition({ weekRange, weekOf, items, verifiedMetrics });
    } catch (err) {
      console.error("[synthesize-edition] LLM synthesis failed:", err);
      res.status(502).json({ error: "Synthesis failed", message: (err as Error).message });
      return;
    }

    const buildEdition = (editionNumber: number) => ({
      editionNumber,
      weekOf,
      weekRange,
      pdfUrl: `desk://edition/${editionNumber}`,
      readingTime: synth.readingTime,
      topics: synth.topics,
      signals: synth.signals,
      fullText: synth.fullText,
      keyMetrics: synth.keyMetrics,
      marketStress: synth.marketStress,
      datesToWatch: synth.datesToWatch,
    });
    let editionNumber: number;
    let edition: ReturnType<typeof buildEdition>;
    try {
      // Atomic allocate-and-insert: retries on editionNumber collision so two
      // concurrent syntheses can't both claim the same number.
      editionNumber = await db.createEditionWithNextNumber(buildEdition);
      edition = buildEdition(editionNumber);
    } catch (err) {
      console.error("[synthesize-edition] DB insert failed:", err);
      res.status(500).json({ error: "Database insert failed" });
      return;
    }

    console.log(
      `[scheduled] synthesised Edition ${editionNumber} (${weekRange}) from ${items.length} feed items`
    );
    invalidate("edition:");
    res.json({
      success: true,
      editionNumber,
      weekOf,
      weekRange,
      topicCount: edition.topics.length,
      signalCount: edition.signals.length,
      sourcedItemCount: items.length,
    });

    // ── Background: editor QC + hero + take + headline SEO ─────────────────
    // The QC pass and headline optimiser run on the LIVE edition so a slow
    // call doesn't hold up the synthesise endpoint. Each step is best-effort
    //, a failure logs and moves on, the edition stays usable either way.
    setImmediate(async () => {
      const inserted = await db.getEditionByNumber(editionNumber);
      if (!inserted) return;

      // Step 1: Editor QC pass. Audits voice, clarity, audience hooks,
      // unsupported claims and applies fixes in place. We feed it the
      // synthesised output (not the DB row, which is the same shape).
      let finalEdition = {
        topics: edition.topics,
        signals: edition.signals,
        keyMetrics: edition.keyMetrics,
        readingTime: edition.readingTime,
        fullText: edition.fullText,
        marketStress: edition.marketStress,
        datesToWatch: edition.datesToWatch,
      };
      try {
        const qc = await runEditorQc(finalEdition);
        if (!qc.approved) {
          console.log(`[editor-qc] Edition ${editionNumber}: applied ${qc.notes.length} edits`);
          for (const n of qc.notes) console.log(`  - ${n}`);
        } else {
          console.log(`[editor-qc] Edition ${editionNumber}: clean on first pass`);
        }
        finalEdition = qc.revised;
        await db.updateEditionSynthesis(inserted.id, {
          topics: finalEdition.topics,
          signals: finalEdition.signals,
          fullText: finalEdition.fullText,
          keyMetrics: finalEdition.keyMetrics,
          marketStress: finalEdition.marketStress,
          datesToWatch: finalEdition.datesToWatch,
        });
      } catch (err) {
        console.warn(`[editor-qc] Edition ${editionNumber} skipped: ${(err as Error).message}`);
      }

      // Step 1b: accountability look-back. Scores last week's forward-looking
      // calls against this week's feed. Best-effort and skipped for the first
      // edition (no prior to grade).
      try {
        const prior = await db.getEditionByNumber(editionNumber - 1);
        if (prior) {
          const lookback = await generateLookback({
            priorWeekRange: prior.weekRange,
            priorTopics: prior.topics ?? [],
            priorDatesToWatch: prior.datesToWatch ?? null,
            thisWeekItems: items,
          });
          if (lookback) {
            await db.updateEditionLookback(inserted.id, lookback);
            console.log(
              `[lookback] Edition ${editionNumber}: scored ${lookback.items.length} prior call(s)`
            );
          }
        }
      } catch (err) {
        console.warn(`[lookback] Edition ${editionNumber} skipped: ${(err as Error).message}`);
      }

      // Step 2: hero image + Ruben's Take in parallel. Hero picks from
      // the library by default, see resolveHeroForEdition for the
      // library-vs-generate decision.
      const [imageResult, takeResult] = await Promise.allSettled([
        resolveHeroForEdition({
          editionId: inserted.id,
          prompt: editionHeroPrompt({
            weekRange,
            topics: finalEdition.topics,
          }),
        }),
        generateRubensTake({
          weekRange,
          topics: finalEdition.topics,
          keyMetrics: finalEdition.keyMetrics,
        }),
      ]);
      if (imageResult.status === "fulfilled" && imageResult.value.ok) {
        await db.updateHeroImage(inserted.id, db.editionAssetUrl(inserted.id, "hero"));
      }
      let rubensTake: string | null = null;
      if (takeResult.status === "fulfilled") {
        rubensTake = takeResult.value;
        await db.updateRubensTake(inserted.id, rubensTake);
      }

      // Step 3: headline + SEO optimiser. Needs the take if we have one
      // (it informs the social-card framing).
      try {
        const seo = await optimiseHeadlines({
          weekRange,
          rubensTake,
          topics: finalEdition.topics,
          fullText: finalEdition.fullText,
        });
        await db.updateEditionSeo(inserted.id, seo);
        console.log(
          `[headline-optimiser] Edition ${editionNumber}: meta + ${seo.headlineVariants.length} variants saved`
        );
      } catch (err) {
        console.warn(
          `[headline-optimiser] Edition ${editionNumber} skipped: ${(err as Error).message}`
        );
      }

      void notifySubscribers(editionNumber, weekRange);
    });
  };
  app.post("/api/scheduled/synthesize-edition", handler);
  app.post("/api/ingest/synthesize-edition", handler);
}

// ─── Subscriber notification ─────────────────────────────────────────────────

async function notifyDailyBriefSubscribers(feedDate: string): Promise<void> {
  try {
    // Partner-facing output: the brief covers the enriched lanes (AU +
    // Property) only. Coverage lanes (Business / Tech / Global) surface on the
    // Today-page tabs but don't belong in a partner's inbox.
    const items = (await db.listFeedItems(feedDate)).filter((it) =>
      isEnrichedChannel(it.channel)
    );
    if (items.length === 0) return;
    const subs = await db.listSubscribersForDailyBrief(feedDate);
    if (subs.length === 0) return;
    const origin = siteOrigin();
    const top5 = items.slice(0, 5);
    const deliveredIds: number[] = [];
    let delivered = 0;
    for (let i = 0; i < subs.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 600));
      const sub = subs[i];
      if (!sub) continue;
      try {
        const result = await sendDailyBriefEmail({
          to: sub.email,
          name: sub.name,
          items: top5,
          feedDate,
          siteUrl: origin,
          unsubscribeUrl: editionUnsubscribeUrl(sub.email, origin),
        });
        if (result.delivered) {
          deliveredIds.push(sub.id);
          delivered++;
        }
      } catch {
        // leave this subscriber unmarked so they're retried next run
      }
    }
    await db.markDailyBriefSent(deliveredIds, feedDate);
    console.log(`[mailer] daily brief ${feedDate}: delivered ${delivered}/${subs.length}`);
  } catch (err) {
    console.warn("[mailer] daily brief notification failed:", err);
  }
}

async function notifySubscribers(editionNumber: number, weekRange: string): Promise<void> {
  try {
    const subs = await db.listConfirmedSubscribers();
    if (subs.length === 0) return;
    const origin = siteOrigin();
    const editionUrl = `${origin}/editions/${editionNumber}`;
    const results = await Promise.allSettled(
      subs.map((sub) =>
        sendEditionNotificationEmail({
          to: sub.email,
          name: sub.name,
          editionNumber,
          weekRange,
          editionUrl,
          unsubscribeUrl: editionUnsubscribeUrl(sub.email, origin),
        })
      )
    );
    const delivered = results.filter((r) => r.status === "fulfilled" && r.value.delivered).length;
    console.log(
      `[mailer] Edition ${editionNumber}: notified ${delivered}/${subs.length} subscribers`
    );
  } catch (err) {
    console.warn(`[mailer] subscriber notification failed:`, err);
  }
}

// ─── Daily metrics ──────────────────────────────────────────────────────────

const dailyMetricsBodySchema = z.object({
  metrics: z
    .array(
      z.object({
        metricKey: z.string().min(1).max(64),
        label: z.string().min(1).max(128),
        value: z.string().min(1).max(64),
        unit: z.string().max(16).optional().nullable(),
        source: z.string().max(64).optional().nullable(),
        context: z.string().max(256).optional().nullable(),
        groupKey: z.string().max(32).optional().nullable(),
        asOf: z.string().datetime().or(z.string().min(1)),
        displayOrder: z.number().int().min(0).max(9999).optional(),
      })
    )
    .min(1),
});

function registerDailyMetricsRoute(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = dailyMetricsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }
    let ok = 0;
    for (const m of parsed.data.metrics) {
      try {
        await db.upsertDailyMetric({
          metricKey: m.metricKey,
          label: m.label,
          value: m.value,
          unit: m.unit ?? null,
          source: m.source ?? null,
          context: m.context ?? null,
          groupKey: m.groupKey ?? null,
          asOf: new Date(m.asOf),
          displayOrder: m.displayOrder,
        });
        ok++;
      } catch (err) {
        console.error(`[metrics] upsert ${m.metricKey} failed:`, err);
      }
    }
    console.log(`[scheduled] upserted ${ok}/${parsed.data.metrics.length} daily metrics`);
    res.json({ success: true, count: ok });
  };
  app.post("/api/scheduled/daily-metrics", handler);
  app.post("/api/ingest/daily-metrics", handler);
}

// ─── News-driven metric extraction ──────────────────────────────────────────
// For metrics whose underlying source is paywalled (CoreLogic, Domain,
// Westpac-MI) but get covered by news outlets within hours, ask the LLM
// to pull the figure from Google News results.

const extractMetricsBodySchema = z.object({
  queries: z
    .array(
      z.object({
        metricKey: z.string().min(1).max(64),
        label: z.string().min(1).max(128),
        unit: z.string().max(16).optional().nullable(),
        groupKey: z.string().max(32).optional().nullable(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        googleQuery: z.string().min(1).max(200),
        guidance: z.string().min(1).max(500),
      })
    )
    .min(1)
    .max(10),
});

function registerExtractMetricsRoute(app: Express): void {
  const parser = new Parser({
    timeout: 8_000,
    headers: { "User-Agent": "TheDesk/1.0" },
  });
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = extractMetricsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }
    let ok = 0;
    let skipped = 0;
    for (const q of parsed.data.queries) {
      try {
        // 1. Fetch Google News RSS for this metric's query.
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q.googleQuery)}&hl=en-AU&gl=AU&ceid=AU:en`;
        const feed = await parser.parseURL(url);
        const articles = (feed.items ?? []).slice(0, 6).map((it) => ({
          title: (it.title ?? "").slice(0, 200),
          summary: (it.contentSnippet ?? it.content ?? "").slice(0, 400),
          source: (it.creator as string | undefined) ?? "Google News",
          url: it.link ?? null,
          date: it.isoDate ?? it.pubDate ?? null,
        }));
        if (articles.length === 0) {
          skipped++;
          continue;
        }
        // 2. Ask the LLM to extract.
        const extracted = await extractMetricFromNews({
          metricLabel: q.label,
          unit: q.unit ?? null,
          guidance: q.guidance,
          articles,
        });
        if (!extracted) {
          skipped++;
          continue;
        }
        // 3. Upsert.
        await db.upsertDailyMetric({
          metricKey: q.metricKey,
          label: q.label,
          value: extracted.value,
          unit: q.unit ?? null,
          source: "News + LLM",
          context: extracted.context,
          groupKey: q.groupKey ?? null,
          sourceUrl: extracted.sourceUrl,
          asOf: extracted.asOf ?? new Date(),
          displayOrder: q.displayOrder,
        });
        ok++;
        console.log(
          `[extract-metric] ${q.metricKey} = ${extracted.value}${q.unit ?? ""} (${extracted.context ?? "no context"})`
        );
      } catch (err) {
        console.error(`[extract-metric] ${q.metricKey} failed:`, (err as Error).message);
        skipped++;
      }
    }
    console.log(`[scheduled] extracted ${ok}/${parsed.data.queries.length} news-driven metrics`);
    res.json({ success: true, extracted: ok, skipped });
  };
  app.post("/api/scheduled/extract-metrics", handler);
  app.post("/api/ingest/extract-metrics", handler);
}

// ─── Weekly recap ────────────────────────────────────────────────────────────

/** Returns the ISO Monday date of the week containing `iso`. */
function weekMondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return monday.toISOString().slice(0, 10);
}

async function sendWeeklyRecap(weekOf: string): Promise<void> {
  try {
    // Mon–Fri of the target week.
    const fridayOffset = new Date(weekOf + "T12:00:00Z");
    fridayOffset.setUTCDate(fridayOffset.getUTCDate() + 4);
    const weekEnd = fridayOffset.toISOString().slice(0, 10);

    const items = await db.listFeedItemsBetween(weekOf, weekEnd);
    if (items.length === 0) return;

    const talkingPoints = items
      .filter((it) => it.sayThis && it.partnerTag)
      .map((it) => ({
        title: it.title,
        category: it.category,
        sayThis: it.sayThis!,
      }));

    const subs = await db.listSubscribersForWeeklyRecap(weekOf);
    if (subs.length === 0) return;

    const origin = siteOrigin();
    const mondayFmt = new Date(weekOf + "T12:00:00Z").toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const fridayFmt = fridayOffset.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const weekRange = `${mondayFmt} – ${fridayFmt}`;

    const deliveredIds: number[] = [];
    let delivered = 0;
    for (let i = 0; i < subs.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 600));
      const sub = subs[i];
      if (!sub) continue;
      try {
        const result = await sendWeeklyRecapEmail({
          to: sub.email,
          name: sub.name,
          weekRange,
          storyCount: items.length,
          talkingPoints,
          thisWeekUrl: `${origin}/this-week`,
          unsubscribeUrl: editionUnsubscribeUrl(sub.email, origin),
        });
        if (result.delivered) {
          deliveredIds.push(sub.id);
          delivered++;
        }
      } catch {
        // leave this subscriber unmarked so they're retried next run
      }
    }
    await db.markWeeklyRecapSent(deliveredIds, weekOf);
    console.log(`[mailer] weekly recap ${weekOf}: delivered ${delivered}/${subs.length}`);
  } catch (err) {
    console.warn("[mailer] weekly recap failed:", err);
  }
}

function registerWeeklyRecapRoute(app: Express): void {
  const weeklyRecapBodySchema = z.object({
    /** ISO date of any day in the target week. Defaults to today. */
    anyDateInWeek: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
  });
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = weeklyRecapBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }
    const target = parsed.data.anyDateInWeek ?? new Date().toISOString().slice(0, 10);
    const weekOf = weekMondayOf(target);
    res.json({ success: true, weekOf });
    void sendWeeklyRecap(weekOf);
  };
  app.post("/api/scheduled/weekly-recap", handler);
  app.post("/api/ingest/weekly-recap", handler);
}

// ─── Talking-point nudge ─────────────────────────────────────────────────────

function registerNudgeCheckRoute(app: Express): void {
  const handler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let sent = 0;
    try {
      const candidates = await db.findQueueItemsNeedingNudge();
      const origin = siteOrigin();
      await Promise.allSettled(
        candidates.map(async (c) => {
          if (!c.userEmail) return;
          const result = await sendTalkingPointNudgeEmail({
            to: c.userEmail,
            storyTitle: c.feedTitle,
            category: c.feedCategory,
            sayThis: c.sayThis,
            yesUrl: nudgeResponseUrl(c.queueId, "yes", origin),
            notYetUrl: nudgeResponseUrl(c.queueId, "not-yet", origin),
          });
          if (result.delivered) {
            await db.markNudgeSent(c.queueId);
            sent++;
          }
        })
      );
    } catch (err) {
      console.warn("[mailer] nudge-check failed:", err);
    }
    console.log(`[mailer] nudge-check: sent ${sent} nudges`);
    res.json({ success: true, sent });
  };
  app.post("/api/scheduled/nudge-check", handler);
  app.post("/api/ingest/nudge-check", handler);
}

function registerNudgeRespondRoute(app: Express): void {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";

  // Public (clicked from email, no session) and it writes to the queue
  // table — keep a per-IP lid on it so the unauthenticated surface can't
  // be used to spam HMAC guesses or DB writes.
  const nudgeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: false,
    legacyHeaders: false,
    message: "Too many requests.",
  });

  app.get("/api/nudge/respond", nudgeLimiter, async (req: Request, res: Response) => {
    const id = parseInt(typeof req.query.id === "string" ? req.query.id : "", 10);
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";
    const result = typeof req.query.result === "string" ? req.query.result : "";

    if (!id || !sig || !["yes", "not-yet"].includes(result)) {
      res.status(400).send("Invalid link.");
      return;
    }

    const { createHmac } = await import("node:crypto");
    const expected = createHmac("sha256", process.env.JWT_SECRET ?? "dev")
      .update(`nudge:${id}`)
      .digest("base64url");

    // Constant-time compare so response latency can't be used to
    // recover the signature byte-by-byte (same treatment as the
    // unsubscribe link and the scheduled-key check).
    const sigOk =
      sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!sigOk) {
      res.status(403).send("Invalid or expired link.");
      return;
    }

    await db.recordNudgeResponse(id, result);

    const isYes = result === "yes";
    const headline = isYes ? "Great — logged as a win." : "Got it — noted.";
    const subtext = isYes
      ? "That angle landed. The Desk will keep surfacing more like it."
      : "Thanks for the honesty. Knowing when it doesn't land is just as useful.";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${headline}</title>
    <style>
      html, body { background: ${NAVY}; color: ${FG}; font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div style="max-width:420px;padding:48px 24px;text-align:center;">
      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:16px;">The Desk</div>
      <h1 style="font-size:26px;font-weight:700;line-height:1.15;letter-spacing:-0.02em;margin:0 0 12px;">${headline}</h1>
      <p style="font-size:16px;line-height:1.55;color:${FG_MUTED};margin:0 0 28px;">${subtext}</p>
      <a href="${siteOrigin()}" style="display:inline-block;padding:13px 28px;background:${AMBER};color:${NAVY};font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-weight:600;border-radius:4px;">Back to The Desk →</a>
    </div>
  </body>
</html>`);
  });
}

// ─── Instagram ───────────────────────────────────────────────────────────────

function registerInstagramRoutes(app: Express): void {
  // Serve temp images for the Instagram API to fetch during container creation.
  // UUIDs are random and entries expire after 5 minutes so this is safe to expose.
  app.get("/instagram/temp/:uuid.jpg", async (req: Request, res: Response) => {
    const { getTempImage } = await import("./instagram/tempStore");
    const entry = getTempImage(routeParam(req.params.uuid));
    if (!entry) {
      res.status(404).json({ error: "Not found or expired" });
      return;
    }
    res.setHeader("Content-Type", entry.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(entry.buffer);
  });

  // POST /api/ingest/instagram-daily  — posts today's top-3 stories as a carousel
  const dailyHandler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { instagramAccessToken, instagramBusinessAccountId } = (await import("./core/env")).env;
    if (!instagramAccessToken || !instagramBusinessAccountId) {
      res.status(503).json({ error: "Instagram credentials not configured" });
      return;
    }
    // Parse optional feedDate override
    const parsed = z
      .object({
        feedDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .safeParse(req.body ?? {});
    const feedDate = parsed.success ? parsed.data.feedDate : undefined;

    // Instagram is partner-facing: post from the enriched lanes (AU +
    // Property) only, never the coverage tabs.
    const items = (await db.listFeedItems(feedDate)).filter((it) =>
      isEnrichedChannel(it.channel)
    );
    if (items.length === 0) {
      res.status(422).json({ error: "No feed items for the requested date" });
      return;
    }
    // Post synchronously and return the real outcome. This used to run in
    // setImmediate after a 200 "queued" response, which meant a failed post
    // (expired token, unreachable image URL, Graph API error) was invisible
    // to the caller — the GitHub Actions job stayed green while nothing
    // posted. Awaiting it lets `curl -f` turn the workflow red on failure so
    // a missing post is actually noticed. The job's 10-minute timeout is
    // ample headroom for image render + Graph API publish.
    try {
      const { postDailyCarousel } = await import("./instagram/post");

      // Checkerboard the profile grid (slide 1 is the grid thumbnail) and
      // surface the morning's market metrics on the cover's lower third. The
      // tone flips from whatever the last grid post used.
      const variant = await nextCoverVariant();
      const metrics = dailyCoverMetrics(await db.listDailyMetrics());
      // The metrics ingest runs before this job, so an empty strip means that
      // job didn't land today. The post still goes out (a clean cover without
      // the strip), but surface it so a silent gap is visible in the console.
      if (metrics.length === 0) {
        console.warn("[instagram] daily cover has no metric strip — daily metrics absent today");
        await db
          .recordServerError({
            level: "warn",
            message: "Instagram daily post: metric strip empty (no daily metrics ingested today)",
            route: "instagram/daily",
          })
          .catch(() => {});
      }

      const { postId, headline } = await postDailyCarousel(items, siteOrigin(), {
        variant,
        metrics,
      });
      console.log(`[instagram] daily post complete: ${postId}`);
      await db.recordInstagramPost({
        mediaId: postId,
        postType: "daily",
        feedDate: feedDate ?? null,
        headline,
        coverVariant: variant,
      });
      res.json({ success: true, postId, headline });
    } catch (err) {
      const e = err as Error;
      console.error("[instagram] daily post failed:", e.message);
      // Still record it for the admin console, but also report it to the
      // caller so the scheduled run fails loudly.
      await db
        .recordServerError({
          level: "error",
          message: `Instagram daily post failed: ${e.message}`.slice(0, 512),
          stack: e.stack ?? null,
          route: "instagram/daily",
        })
        .catch(() => {});
      res.status(502).json({ error: "Instagram daily post failed", message: e.message });
    }
  };
  app.post("/api/scheduled/instagram-daily", dailyHandler);
  app.post("/api/ingest/instagram-daily", dailyHandler);

  // POST /api/ingest/instagram-coverage — the midday "Wider lens" carousel
  // across the coverage lanes (Tech & Science, Business, Global). Same card
  // format as the daily post, but the mirror-image channel filter, no market
  // metrics strip, and no partner say-this lines (coverage carries no angle).
  const coverageHandler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { instagramAccessToken, instagramBusinessAccountId } = (await import("./core/env")).env;
    if (!instagramAccessToken || !instagramBusinessAccountId) {
      res.status(503).json({ error: "Instagram credentials not configured" });
      return;
    }
    const parsed = z
      .object({
        feedDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .safeParse(req.body ?? {});
    const feedDate = parsed.success ? parsed.data.feedDate : undefined;

    // The opposite filter to the daily post: coverage lanes only.
    const items = (await db.listFeedItems(feedDate)).filter(
      (it) => !isEnrichedChannel(it.channel)
    );
    if (items.length === 0) {
      res.status(422).json({ error: "No coverage stories for the requested date" });
      return;
    }
    try {
      const { postDailyCarousel } = await import("./instagram/post");
      // Flip from the morning's daily cover so the two alternate.
      const variant = await nextCoverVariant();
      const { postId, headline } = await postDailyCarousel(items, siteOrigin(), {
        variant,
        mode: "coverage",
      });
      console.log(`[instagram] coverage post complete: ${postId}`);
      await db.recordInstagramPost({
        mediaId: postId,
        postType: "coverage",
        feedDate: feedDate ?? null,
        headline,
        coverVariant: variant,
      });
      res.json({ success: true, postId, headline });
    } catch (err) {
      const e = err as Error;
      console.error("[instagram] coverage post failed:", e.message);
      await db
        .recordServerError({
          level: "error",
          message: `Instagram coverage post failed: ${e.message}`.slice(0, 512),
          stack: e.stack ?? null,
          route: "instagram/coverage",
        })
        .catch(() => {});
      res.status(502).json({ error: "Instagram coverage post failed", message: e.message });
    }
  };
  app.post("/api/scheduled/instagram-coverage", coverageHandler);
  app.post("/api/ingest/instagram-coverage", coverageHandler);

  // POST /api/ingest/instagram-weekly  — posts the latest weekly edition as a carousel
  const weeklyHandler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { instagramAccessToken, instagramBusinessAccountId } = (await import("./core/env")).env;
    if (!instagramAccessToken || !instagramBusinessAccountId) {
      res.status(503).json({ error: "Instagram credentials not configured" });
      return;
    }
    const editions = await db.listEditions();
    const latest = editions[0];
    if (!latest) {
      res.status(422).json({ error: "No editions available" });
      return;
    }
    // Synchronous for the same reason as the daily post: a green workflow
    // must mean the edition actually posted, not just that the request was
    // accepted.
    try {
      const { postWeeklyEdition } = await import("./instagram/post");
      // The weekly now flips from the last grid post too, so it slots into the
      // checkerboard instead of always being navy and clashing.
      const variant = await nextCoverVariant();
      const { postId, headline } = await postWeeklyEdition(latest, siteOrigin(), variant);
      console.log(`[instagram] weekly post complete: ${postId}`);
      await db.recordInstagramPost({
        mediaId: postId,
        postType: "weekly",
        editionNumber: latest.editionNumber,
        headline,
        coverVariant: variant,
      });
      res.json({ success: true, editionNumber: latest.editionNumber, postId, headline });
    } catch (err) {
      const e = err as Error;
      console.error("[instagram] weekly post failed:", e.message);
      await db
        .recordServerError({
          level: "error",
          message: `Instagram weekly post failed: ${e.message}`.slice(0, 512),
          stack: e.stack ?? null,
          route: "instagram/weekly",
        })
        .catch(() => {});
      res.status(502).json({ error: "Instagram weekly post failed", message: e.message });
    }
  };
  app.post("/api/scheduled/instagram-weekly", weeklyHandler);
  app.post("/api/ingest/instagram-weekly", weeklyHandler);

  // GET /api/instagram/preview/:kind — render a single card to a browser so the
  // posts can be eyeballed (notably the real per-edition hero) before anything
  // publishes. Auth is the same as the cron handlers: ?key=… or an admin
  // session cookie. Renders straight from the DB; weekly is byte-identical to
  // what posts. Daily uses the raw feed titles (it skips the LLM headline
  // punch-up the live post applies) but is otherwise the production path.
  //   kind: weekly-cover | weekly-story | weekly-topic | daily-cover
  //       | daily-slide | daily-story
  //   query: ?editionNumber=N (weekly) · ?date=YYYY-MM-DD&variant=navy|light
  //          (daily) · ?i=N (topic/slide index)
  app.get("/api/instagram/preview/:kind", async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const kind = routeParam(req.params.kind);
    const idx = Number.parseInt(typeof req.query.i === "string" ? req.query.i : "0", 10) || 0;
    try {
      const cards = await import("./og/instagramCards");
      const { sanitizeDashes, pickDailyTopStories, loadEditionHeroDataUri } =
        await import("./instagram/post");
      let buf: Buffer | null = null;

      if (kind.startsWith("weekly")) {
        const editions = await db.listEditions();
        const wanted =
          typeof req.query.editionNumber === "string" ? Number(req.query.editionNumber) : null;
        const edition = wanted ? editions.find((e) => e.editionNumber === wanted) : editions[0];
        if (!edition) {
          res.status(422).json({ error: "No matching edition" });
          return;
        }
        const hero = await loadEditionHeroDataUri(edition.id);
        if (kind === "weekly-cover") buf = await cards.renderWeeklyCoverCard(edition, hero);
        else if (kind === "weekly-story")
          buf = await cards.renderWeeklyStoryVertical(edition, hero);
        else if (kind === "weekly-topic") {
          const topic = edition.topics[idx];
          if (!topic) {
            res.status(404).json({ error: "No topic at that index" });
            return;
          }
          buf = await cards.renderWeeklyTopicCard(topic, idx + 1, 1 + edition.topics.length);
        }
      } else if (kind.startsWith("daily")) {
        const date = typeof req.query.date === "string" ? req.query.date : undefined;
        const variant =
          req.query.variant === "light"
            ? "light"
            : req.query.variant === "navy"
              ? "navy"
              : "light";
        const stories = pickDailyTopStories(
          (await db.listFeedItems(date)).filter((it) => isEnrichedChannel(it.channel))
        ).map((s) => ({
          ...s,
          title: sanitizeDashes(s.title),
          whyItMatters: s.whyItMatters ? sanitizeDashes(s.whyItMatters) : s.whyItMatters,
          source: s.source ? sanitizeDashes(s.source) : s.source,
          category: s.category ? sanitizeDashes(s.category) : s.category,
        }));
        if (stories.length === 0) {
          res.status(422).json({ error: "No feed items for that date" });
          return;
        }
        if (kind === "daily-cover") {
          const metrics = dailyCoverMetrics(await db.listDailyMetrics());
          buf = await cards.renderDailyCoverCard(stories, stories[0]!.feedDate, variant, metrics);
        } else if (kind === "daily-slide") {
          const story = stories[idx];
          if (!story) {
            res.status(404).json({ error: "No slide at that index" });
            return;
          }
          buf = await cards.renderDailyStoryCard(story, idx, stories.length, variant);
        } else if (kind === "daily-story") {
          buf = await cards.renderDailyStoryVertical(stories[0]!, variant);
        }
      }

      if (!buf) {
        res.status(400).json({ error: `Unknown preview kind: ${kind}` });
        return;
      }
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch (err) {
      const e = err as Error;
      console.error(`[instagram] preview ${kind} failed:`, e.message);
      res.status(500).json({ error: "Preview failed", message: e.message });
    }
  });

  // POST /api/ingest/instagram-insights  — backfills engagement metrics for
  // recently published posts. Runs daily, a day after posting, so the numbers
  // have had time to accumulate.
  const insightsHandler = async (req: Request, res: Response) => {
    if (!(await authenticateScheduled(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { instagramAccessToken } = (await import("./core/env")).env;
    if (!instagramAccessToken) {
      res.status(503).json({ error: "Instagram credentials not configured" });
      return;
    }
    res.json({ success: true, message: "Instagram insights refresh queued" });

    setImmediate(async () => {
      try {
        const { fetchMediaMetrics } = await import("./instagram/api");
        const posts = await db.listInstagramPostsNeedingMetrics();
        let updated = 0;
        for (const post of posts) {
          const metrics = await fetchMediaMetrics({
            mediaId: post.mediaId,
            accessToken: instagramAccessToken,
          });
          await db.updateInstagramPostMetrics(post.mediaId, metrics);
          updated++;
        }
        console.log(`[instagram] insights refreshed for ${updated}/${posts.length} posts`);
      } catch (err) {
        console.error("[instagram] insights refresh failed:", (err as Error).message);
      }
    });
  };
  app.post("/api/scheduled/instagram-insights", insightsHandler);
  app.post("/api/ingest/instagram-insights", insightsHandler);
}

export function registerScheduledRoutes(app: Express): void {
  registerDailyFeedRoute(app);
  registerWeeklyEditionRoute(app);
  registerSynthesizeEditionRoute(app);
  registerDailyMetricsRoute(app);
  registerExtractMetricsRoute(app);
  registerWeeklyRecapRoute(app);
  registerNudgeCheckRoute(app);
  registerNudgeRespondRoute(app);
  registerInstagramRoutes(app);
  console.log(
    "[scheduled] registered /api/{scheduled,ingest}/{daily-feed,weekly-edition,synthesize-edition,daily-metrics,extract-metrics,weekly-recap,nudge-check,instagram-daily,instagram-weekly,instagram-insights} + /api/nudge/respond + /instagram/temp/:uuid.jpg + /api/instagram/preview/:kind"
  );
}

// Re-export schemas so tests can import the shape from this module's surface.
export { dailyFeedIngestBodySchema, weeklyEditionIngestSchema, z };
