import { z } from "zod";
import * as db from "../db";
import { cached, cacheKey, invalidate } from "../core/cache";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { generateSayThis, generateWhyItMatters } from "../prompts";

/**
 * Public feed reads are cached for a short window: every anonymous
 * visitor hits these, but the data changes only on the daily ingest or
 * an admin edit. 30s collapses a read storm into a single DB query while
 * keeping staleness imperceptible; the admin mutations below bust the
 * "feed:" namespace so edits surface immediately regardless.
 */
const FEED_TTL_MS = 30_000;

const feedDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "feedDate must be YYYY-MM-DD");

function sydneyTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function weekMondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return monday.toISOString().slice(0, 10);
}

export const feedRouter = router({
  /** Today's items by default, or items for a specific YYYY-MM-DD. */
  getByDate: publicProcedure
    .input(z.object({ date: feedDateSchema.optional() }).optional())
    .query(async ({ input }) =>
      cached(cacheKey("feed:byDate", input?.date ?? null), FEED_TTL_MS, () =>
        db.listFeedItems(input?.date)
      )
    ),

  /** A single feed item by id, used by the /story/:id page. */
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => db.getFeedItemById(input.id)),

  /**
   * Batch fetch, used by the anonymous reading queue which keeps a
   * localStorage list of saved item ids and needs to hydrate them all
   * in one request. Capped at 60 so callers can't pull the world.
   */
  getByIds: publicProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).max(60) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      return db.getFeedItemsByIds(input.ids);
    }),

  /** Dates that have at least one feed item, newest first. */
  getRecentDates: publicProcedure.query(async () =>
    cached(cacheKey("feed:recentDates"), FEED_TTL_MS, () => db.getRecentFeedDates())
  ),

  /**
   * All feed items for the current ISO week (Mon–today in Sydney time).
   * Powers the "This week's talking points" page so readers can prep
   * for client calls without paging through individual days.
   */
  getByWeek: publicProcedure
    .input(z.object({ anyDate: feedDateSchema.optional() }).optional())
    .query(async ({ input }) => {
      const today = sydneyTodayIso();
      const date = input?.anyDate ?? today;
      const weekStart = weekMondayOf(date);
      const weekEnd = date <= today ? date : today;
      return cached(cacheKey("feed:week", [weekStart, weekEnd]), FEED_TTL_MS, () =>
        db.listFeedItemsBetween(weekStart, weekEnd)
      );
    }),

  /** Paginated archive across all dates, optionally filtered by category. */
  archive: publicProcedure
    .input(
      z.object({
        category: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(60).default(30),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) =>
      cached(cacheKey("feed:archive", input), FEED_TTL_MS, () => db.listArchive(input))
    ),

  /**
   * Admin: fill in missing `sayThis` lines for recent feed items. Runs the LLM
   * once per item; safe to re-run because items with a populated `sayThis` are
   * skipped. Returns counts so the Admin console can show the result.
   */
  backfillSayThis: adminProcedure
    .input(
      z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional()
    )
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const items = await db.listFeedItemsMissingSayThis(limit);
      let updated = 0;
      let skipped = 0;
      for (const item of items) {
        const line = await generateSayThis({
          title: item.title,
          summary: item.summary,
          category: item.category,
        });
        if (!line) {
          skipped++;
          continue;
        }
        await db.updateFeedItemSayThis(item.id, line);
        updated++;
      }
      if (updated > 0) invalidate("feed:");
      return { scanned: items.length, updated, skipped };
    }),

  /**
   * Backfill the "Why it matters" context line for stories ingested before
   * the column existed (all of them have it null). Same shape as
   * backfillSayThis: scan recent items, generate, persist, skip SKIPs.
   */
  backfillWhyItMatters: adminProcedure
    .input(
      z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional()
    )
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const items = await db.listFeedItemsMissingWhyItMatters(limit);
      let updated = 0;
      let skipped = 0;
      for (const item of items) {
        const line = await generateWhyItMatters({
          title: item.title,
          summary: item.summary,
          category: item.category,
        });
        if (!line) {
          skipped++;
          continue;
        }
        await db.updateFeedItemWhyItMatters(item.id, line);
        updated++;
      }
      if (updated > 0) invalidate("feed:");
      return { scanned: items.length, updated, skipped };
    }),

  /**
   * Admin: delete a single feed item by id. Used to clean up off-topic
   * stories that slip through the ingest filters (e.g. a sport story
   * mis-tagged POLICY).
   */
  deleteItem: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteFeedItem(input.id);
      invalidate("feed:");
      return { success: true } as const;
    }),

  /**
   * Admin: attach a "Ruben's note" to a feed item. The note appears on
   * the story card as a highlighted editorial quote, overriding the AI's
   * sayThis line visually. Pass an empty string to clear.
   */
  setRubensNote: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        note: z.string().max(600),
      })
    )
    .mutation(async ({ input }) => {
      const trimmed = input.note.trim();
      await db.updateFeedItemRubensNote(input.id, trimmed.length > 0 ? trimmed : null);
      invalidate("feed:");
      return { success: true } as const;
    }),

  /**
   * Admin: set a story's editorial priority. 100 = pinned lead, 0 = buried.
   * Ordering on the Today page is `priority DESC, createdAt DESC`.
   */
  setPriority: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        priority: z.number().int().min(0).max(100),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateFeedItemPriority(input.id, input.priority);
      invalidate("feed:");
      return { success: true } as const;
    }),
});
