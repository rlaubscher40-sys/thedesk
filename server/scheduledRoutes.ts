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
  feedItemImagePrompt,
  generatePartnerTag,
  generateRubensTake,
  generateSayThis,
} from "./prompts";

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

    const items = parsed.data.items.map((item) => ({
      feedDate: item.feedDate,
      title: sanitiseText(item.title),
      source: sanitiseText(item.source),
      sourceUrl: item.sourceUrl ?? null,
      summary: sanitiseText(item.summary),
      category: item.category.toUpperCase(),
      imageUrl: item.imageUrl ?? null,
      partnerTag: sanitiseText(item.partnerTag ?? null),
      sayThis: sanitiseText(item.sayThis ?? null),
      promotedToEdition: false,
    }));

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
                item.imageUrl
                  ? Promise.resolve({ url: item.imageUrl })
                  : generateImage({
                      prompt: feedItemImagePrompt({
                        title: item.title,
                        summary: item.summary,
                        category: item.category,
                      }),
                    }),
              ]);

              if (tag.status === "fulfilled" && tag.value) {
                await db.updateFeedItemPartnerTag(id, tag.value);
                tagOk++;
              }
              if (say.status === "fulfilled" && say.value) {
                await db.updateFeedItemSayThis(id, say.value);
                sayOk++;
              }
              if (img.status === "fulfilled" && img.value?.url) {
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

      if (imageResult.status === "fulfilled" && imageResult.value.url) {
        await db.updateHeroImage(inserted.id, imageResult.value.url);
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

export function registerScheduledRoutes(app: Express): void {
  registerDailyFeedRoute(app);
  registerWeeklyEditionRoute(app);
  console.log(
    "[scheduled] registered /api/scheduled/{daily-feed,weekly-edition} and /api/ingest/{daily-feed,weekly-edition}"
  );
}

// Re-export schemas so tests can import the shape from this module's surface.
export { dailyFeedIngestBodySchema, weeklyEditionIngestSchema, z };
