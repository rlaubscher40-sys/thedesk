/**
 * Two POST endpoints fired by the external scheduler:
 *
 *   POST /api/scheduled/daily-feed   — bulk ingest of daily scan items
 *   POST /api/scheduled/weekly-edition — single weekly edition payload
 *
 * Both authenticate against SCHEDULED_API_KEY (header or `?key=`), validate the
 * payload via Zod, persist what's valid, and schedule LLM enrichment in
 * setImmediate so the HTTP response returns quickly.
 */
import { COOKIE_NAME } from "../shared/const";
import { defaultFeedPriority } from "../shared/feedPriority";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { env } from "./core/env";
import { generateImage } from "./core/image";
import { sdk } from "./core/sdk";
import * as db from "./db";
import {
  dailyFeedIngestBodySchema,
  weeklyEditionIngestSchema,
} from "../shared/schemas";
import {
  editionHeroPrompt,
  extractMetricFromNews,
  feedItemImagePrompt,
  generatePartnerTag,
  generateRubensTake,
  generateSayThis,
  optimiseHeadlines,
  runEditorQc,
  synthesizeWeeklyEdition,
} from "./prompts";
import Parser from "rss-parser";

// ─── Auth ───────────────────────────────────────────────────────────────────

async function authenticateScheduled(req: Request): Promise<boolean> {
  if (env.scheduledApiKey) {
    const headerKey = req.headers["x-scheduled-key"];
    const queryKey = typeof req.query.key === "string" ? req.query.key : undefined;
    const provided = (typeof headerKey === "string" ? headerKey : undefined) ?? queryKey;
    if (provided && provided === env.scheduledApiKey) return true;
  }
  // Fallback: an admin session cookie also unlocks the endpoint (useful for
  // local "run the cron by hand" testing).
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await sdk.verifySession(cookies[COOKIE_NAME]);
  return Boolean(session);
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
        imageUrl: item.imageUrl ?? null,
        partnerTag: sanitiseText(item.partnerTag ?? null),
        sayThis: sanitiseText(item.sayThis ?? null),
        promotedToEdition: false,
        // Editorial-impact baseline. The admin can override per-item via
        // feed.setPriority — manual control always wins.
        priority: defaultFeedPriority({ category, source }),
      };
    });

    try {
      await db.createFeedItems(items);
    } catch (err) {
      console.error("[scheduled] daily-feed insert failed:", err);
      res.status(500).json({ error: "Database insert failed" });
      return;
    }

    res.json({ success: true, count: items.length });

    // ── Background: partnerTag + sayThis + per-item image enrichment ─────
    const feedDate = items[0]?.feedDate;
    if (feedDate) {
      setImmediate(async () => {
        try {
          const inserted = await db.listFeedItems(feedDate);
          const byTitle = new Map<string, number>();
          for (const row of inserted) byTitle.set(row.title, row.id);

          let tagOk = 0;
          let sayOk = 0;
          let imgOk = 0;
          await Promise.all(
            items.map(async (item) => {
              const id = byTitle.get(item.title);
              if (!id) return;

              // All three enrichments fan out in parallel per item.
              const [tag, say, img] = await Promise.allSettled([
                item.partnerTag
                  ? Promise.resolve(item.partnerTag)
                  : generatePartnerTag({
                      title: item.title,
                      summary: item.summary,
                      existingTag: item.partnerTag,
                    }),
                item.sayThis
                  ? Promise.resolve(item.sayThis)
                  : generateSayThis({
                      title: item.title,
                      summary: item.summary,
                      category: item.category,
                    }),
                // Feed items don't use AI thumbnails post-refactor — they
                // rely on the og:image scraped during ingest. Wiring per-
                // item asset storage is doable (mirror the edition_assets
                // pattern keyed on feedItemId) but isn't worth the schema
                // churn for thumbnails that come free from the source URL.
                item.imageUrl
                  ? Promise.resolve({ url: item.imageUrl })
                  : Promise.resolve(null),
              ]);

              if (tag.status === "fulfilled" && tag.value) {
                await db.updateFeedItemPartnerTag(id, tag.value);
                tagOk++;
              }
              if (say.status === "fulfilled" && say.value) {
                await db.updateFeedItemSayThis(id, say.value);
                sayOk++;
              }
              if (
                img.status === "fulfilled" &&
                img.value &&
                "url" in img.value &&
                img.value.url
              ) {
                await db.updateFeedItemImageUrl(id, img.value.url);
                imgOk++;
              }
            })
          );
          console.log(
            `[scheduled] enriched ${feedDate}: ${tagOk} partnerTags, ${sayOk} sayThis, ${imgOk} images`
          );
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
      signals: body.signals.map((s) => sanitiseText(s)),
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
    res.json({ success: true, editionNumber: edition.editionNumber });

    // ── Background: hero image + Ruben's Take ──────────────────────────────
    setImmediate(async () => {
      const inserted = await db.getEditionByNumber(edition.editionNumber);
      if (!inserted) return;

      // Hero image and take are independent — run them in parallel.
      const [imageResult, takeResult] = await Promise.allSettled([
        generateImage({
          prompt: editionHeroPrompt({ weekRange: edition.weekRange, topics: edition.topics }),
        }),
        generateRubensTake({
          weekRange: edition.weekRange,
          topics: edition.topics,
          keyMetrics: edition.keyMetrics,
        }),
      ]);

      if (imageResult.status === "fulfilled" && imageResult.value) {
        await db.storeEditionAsset({
          editionId: inserted.id,
          kind: "hero",
          contentType: imageResult.value.contentType,
          bytes: imageResult.value.bytes,
        });
        await db.updateHeroImage(inserted.id, db.editionAssetUrl(inserted.id, "hero"));
        console.log(`[scheduled] hero image generated for Edition ${edition.editionNumber}`);
      } else if (imageResult.status === "rejected") {
        console.warn(`[scheduled] hero image failed:`, imageResult.reason);
      }

      if (takeResult.status === "fulfilled") {
        await db.updateRubensTake(inserted.id, takeResult.value);
        console.log(`[scheduled] Ruben's Take generated for Edition ${edition.editionNumber}`);
      } else {
        console.warn(`[scheduled] Ruben's Take failed:`, takeResult.reason);
      }
    });
  };
  app.post("/api/scheduled/weekly-edition", handler);
  app.post("/api/ingest/weekly-edition", handler);
}

// ─── Weekly edition synthesis from feed ─────────────────────────────────────

const synthesizeEditionBodySchema = z.object({
  /** ISO date (YYYY-MM-DD) of any day in the target week. Defaults to today. */
  anyDateInWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
});

/**
 * Returns the Monday and Sunday of the ISO week containing `iso` as
 * "YYYY-MM-DD" strings. Used to bound the feed-items query and to label
 * the new edition.
 */
function isoWeekBounds(iso: string): { weekStart: string; weekEnd: string; weekRange: string; weekOf: string } {
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

    const items = await db.listFeedItemsBetween(weekStart, weekEnd);
    if (items.length === 0) {
      res.status(422).json({
        error: "No feed items in target week",
        weekStart,
        weekEnd,
      });
      return;
    }

    // Refuse to overwrite — if an edition already exists for this week, bail
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

    let synth;
    try {
      synth = await synthesizeWeeklyEdition({ weekRange, weekOf, items });
    } catch (err) {
      console.error("[synthesize-edition] LLM synthesis failed:", err);
      res.status(502).json({ error: "Synthesis failed", message: (err as Error).message });
      return;
    }

    const editionNumber = await db.getNextEditionNumber();
    const edition = {
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
    };
    try {
      await db.createEdition(edition);
    } catch (err) {
      console.error("[synthesize-edition] DB insert failed:", err);
      res.status(500).json({ error: "Database insert failed" });
      return;
    }

    console.log(
      `[scheduled] synthesised Edition ${editionNumber} (${weekRange}) from ${items.length} feed items`
    );
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
    // — a failure logs and moves on, the edition stays usable either way.
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
          console.log(
            `[editor-qc] Edition ${editionNumber}: applied ${qc.notes.length} edits`
          );
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
        console.warn(
          `[editor-qc] Edition ${editionNumber} skipped: ${(err as Error).message}`
        );
      }

      // Step 2: hero image + Ruben's Take in parallel.
      const [imageResult, takeResult] = await Promise.allSettled([
        generateImage({
          prompt: editionHeroPrompt({ weekRange, topics: finalEdition.topics }),
        }),
        generateRubensTake({
          weekRange,
          topics: finalEdition.topics,
          keyMetrics: finalEdition.keyMetrics,
        }),
      ]);
      if (imageResult.status === "fulfilled" && imageResult.value) {
        await db.storeEditionAsset({
          editionId: inserted.id,
          kind: "hero",
          contentType: imageResult.value.contentType,
          bytes: imageResult.value.bytes,
        });
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
    });
  };
  app.post("/api/scheduled/synthesize-edition", handler);
  app.post("/api/ingest/synthesize-edition", handler);
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

export function registerScheduledRoutes(app: Express): void {
  registerDailyFeedRoute(app);
  registerWeeklyEditionRoute(app);
  registerSynthesizeEditionRoute(app);
  registerDailyMetricsRoute(app);
  registerExtractMetricsRoute(app);
  console.log(
    "[scheduled] registered /api/{scheduled,ingest}/{daily-feed,weekly-edition,synthesize-edition,daily-metrics,extract-metrics}"
  );
}

// Re-export schemas so tests can import the shape from this module's surface.
export { dailyFeedIngestBodySchema, weeklyEditionIngestSchema, z };
