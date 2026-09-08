import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderDailyHookCoverCard } from "../core/publicRender";
import { renderDeskTakeCard } from "../core/publicRender";
import { publicProcedure, router } from "../core/trpc";

async function enforceRenderQuota(
  authenticated: boolean,
  req: Parameters<typeof consumeAnonymousCard>[0]
) {
  if (authenticated) return;
  const quota = await consumeAnonymousCard(req);
  if (!quota.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You've used today's ${quota.limit} free share renders. Sign in to keep going.`,
    });
  }
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function buildStoryShareCaption(item: {
  title: string;
  whyItMatters?: string | null;
  sayThis?: string | null;
  source?: string | null;
}): string {
  const line = clean(item.sayThis) || clean(item.whyItMatters);
  const source = clean(item.source);
  return [
    item.title.trim(),
    line,
    source ? `Source: ${source}` : "",
    "The Desk · Australian property intelligence",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function storyDeskTake(item: {
  rubensNote?: string | null;
  sayThis?: string | null;
  counterpoint?: string | null;
}): string | null {
  return clean(item.rubensNote) || clean(item.sayThis) || clean(item.counterpoint) || null;
}

/**
 * Distribution assets generated from trusted Desk records rather than
 * arbitrary client-provided copy. Keeping both renderers behind an id lookup
 * means neither the headline card nor The Desk Take can drift from the story
 * currently live on The Desk.
 */
export const shareRouter = router({
  storyCard: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.getFeedItemById(input.id);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Story not found." });
      }

      await enforceRenderQuota(Boolean(ctx.user), ctx.req);

      try {
        const jpeg = await renderDailyHookCoverCard({
          feedDate: item.feedDate,
          lead: {
            title: item.title,
            category: item.category,
            source: item.source,
            whyItMatters: item.whyItMatters || item.summary,
          },
        });
        return {
          mimeType: "image/jpeg" as const,
          filename: `the-desk-story-${item.id}.jpg`,
          base64: jpeg.toString("base64"),
          caption: buildStoryShareCaption(item),
          sharePath: `/story/${item.id}`,
        };
      } catch (error) {
        console.error("[share] story card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render this story card.",
        });
      }
    }),

  /**
   * Render the story's editorial interpretation as its own social object. The
   * take is selected server-side in order of authorship strength: Ruben note,
   * Say This, then counterpoint. If the story has no editorial layer, fail
   * closed instead of inventing one for the card.
   */
  takeCard: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.getFeedItemById(input.id);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Story not found." });
      }
      const take = storyDeskTake(item);
      if (!take) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This story does not have a Desk Take to share yet.",
        });
      }

      await enforceRenderQuota(Boolean(ctx.user), ctx.req);

      try {
        const png = await renderDeskTakeCard({
          take,
          storyTitle: item.title,
          category: item.category,
          source: item.source ?? null,
          context: item.whyItMatters || item.summary || null,
          feedDate: item.feedDate,
        });
        const caption = [
          "THE DESK TAKE",
          take,
          clean(item.whyItMatters),
          item.source ? `Source: ${clean(item.source)}` : "",
          "The Desk · Australian property intelligence",
        ]
          .filter(Boolean)
          .join("\n\n");
        return {
          mimeType: "image/png" as const,
          filename: `the-desk-take-${item.id}.png`,
          base64: png.toString("base64"),
          caption,
          sharePath: `/story/${item.id}`,
        };
      } catch (error) {
        console.error("[share] Desk Take card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render this take card.",
        });
      }
    }),
});
