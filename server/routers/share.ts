import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderDailyStoryCard } from "../og/instagramCards";
import { publicProcedure, router } from "../core/trpc";

function enforceRenderQuota(authenticated: boolean, req: Parameters<typeof consumeAnonymousCard>[0]) {
  if (authenticated) return;
  const quota = consumeAnonymousCard(req);
  if (!quota.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You've used today's ${quota.limit} free share renders. Sign in to keep going.`,
    });
  }
}

/**
 * Distribution assets that are generated from trusted Desk records rather than
 * arbitrary client-provided copy. Keeping the renderer behind an id lookup
 * means a share card can never drift away from the story actually published.
 */
export const shareRouter = router({
  storyCard: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.getFeedItemById(input.id);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Story not found." });
      }

      enforceRenderQuota(Boolean(ctx.user), ctx.req);

      try {
        const jpeg = await renderDailyStoryCard(item, 0, 1, "navy");
        const caption = [
          item.title,
          item.whyItMatters ? `Why it matters: ${item.whyItMatters}` : null,
          item.sayThis ? `The line: ${item.sayThis}` : null,
          item.source ? `Source: ${item.source}` : null,
          "The Desk · Australian property intelligence",
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n\n");

        return {
          mimeType: "image/jpeg" as const,
          filename: `the-desk-story-${item.id}.jpg`,
          base64: jpeg.toString("base64"),
          caption,
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
});
