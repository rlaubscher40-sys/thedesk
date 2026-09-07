import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import { renderSignalCard } from "../og/signalCard";
import { publicProcedure, router } from "../core/trpc";

export const signalsRouter = router({
  shareCard: publicProcedure
    .input(
      z.object({
        label: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(40),
        context: z.string().trim().max(260).nullable(),
        move: z.string().trim().max(100).nullable(),
        deskTake: z.string().trim().max(360).nullable(),
        source: z.string().trim().max(80).nullable(),
        asOf: z.string().trim().max(80).nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        const quota = consumeAnonymousCard(ctx.req);
        if (!quota.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `You've used today's ${quota.limit} free social-card renders. Sign in to keep going.`,
          });
        }
      }

      try {
        const png = await renderSignalCard(input);
        return {
          mimeType: "image/png" as const,
          filename: "the-desk-the-number.png",
          base64: png.toString("base64"),
          sharePath: "/signals",
        };
      } catch (error) {
        console.error("[signals] card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render the signal card.",
        });
      }
    }),
});
