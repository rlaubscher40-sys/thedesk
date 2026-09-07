import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderDailyHookCoverCard } from "../og/dailyHookCover";
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
  return [item.title.trim(), line, source ? `Source: ${source}` : "", "The Desk · Australian property intelligence"]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Distribution assets generated from trusted Desk records rather than
 * arbitrary client-provided copy. The story itself becomes the social hook:
 * large headline first, evidence/context second, brand last. Keeping the
 * renderer behind an id lookup means the card cannot drift from the story live
 * on The Desk.
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
});
