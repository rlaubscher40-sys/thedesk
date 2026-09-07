import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicMarket } from "../../shared/marketDirectory";
import { getMarketDirectory } from "../markets/discovery";
import { getCityRents } from "../markets/absRents";
import { comparisonInputSchema } from "../../shared/marketComparison";
import { checkAnonymousAsk, consumeAnonymousAsk } from "../core/askQuota";
import {
  createIntelligenceShareToken,
  readIntelligenceShareToken,
} from "../core/intelligenceShare";
import { invokeLLMJson } from "../core/llm";
import { publicProcedure, router } from "../core/trpc";
import { retrieveMarketEvidence } from "../markets/evidence";
import { groundComparison } from "../markets/grounding";
import { buildComparisonMessages, comparisonResponseFormat } from "../prompts/marketComparison";

export const marketsRouter = router({
  rentalConditions: publicProcedure.query(() => getCityRents()),
  discovery: publicProcedure.query(() => getMarketDirectory()),
  publicFile: publicProcedure
    .input(z.object({ slug: z.string().max(40) }))
    .query(async ({ input }) => {
      if (!publicMarket(input.slug)) throw new TRPCError({ code: "NOT_FOUND" });
      const directory = await getMarketDirectory();
      return {
        directory,
        file: directory.markets.find((item) => item.market.slug === input.slug)!,
      };
    }),
  compare: publicProcedure.input(comparisonInputSchema).mutation(async ({ input, ctx }) => {
    // Reject exhausted readers before retrieval; charge only when both files have evidence.
    const quota = ctx.user ? null : checkAnonymousAsk(ctx.req);
    if (quota && !quota.allowed)
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "You've used today's free intelligence questions. Sign in to keep comparing.",
      });
    const sources = await retrieveMarketEvidence(input.marketA, input.marketB);
    const insufficient = {
      status: "insufficient" as const,
      message:
        "The Desk cannot make a grounded comparison from the available local evidence yet. Missing coverage is not a negative market signal.",
      coverage: {
        a: sources.filter((source) => source.markets.includes("a")).length,
        b: sources.filter((source) => source.markets.includes("b")).length,
      },
      sources: sources.map(({ text: _text, ...source }) => source),
      anonymousRemaining: quota?.remaining ?? null,
    };
    if (!insufficient.coverage.a || !insufficient.coverage.b) return insufficient;
    // Recheck atomically after the asynchronous read so concurrent requests cannot
    // all spend the same remaining question. No model cost before this point.
    const charged = ctx.user ? null : consumeAnonymousAsk(ctx.req);
    if (charged && !charged.allowed)
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "You've used today's free intelligence questions. Sign in to keep comparing.",
      });
    insufficient.anonymousRemaining = charged?.remaining ?? null;
    try {
      const raw = await invokeLLMJson<unknown>({
        messages: buildComparisonMessages(
          input.marketA,
          input.marketB,
          sources,
          new Date().toISOString().slice(0, 10)
        ),
        responseFormat: comparisonResponseFormat,
        maxTokens: 6200,
        tier: "standard",
        thinking: false,
      });
      const comparison = groundComparison(raw, sources, input.marketA, input.marketB);
      if (!comparison) return insufficient;
      const shareToken = createIntelligenceShareToken({
        question: `${comparison.marketA} vs ${comparison.marketB}: where is the evidence stronger?`,
        headline: `${comparison.marketA} vs ${comparison.marketB}`,
        answer: comparison.verdict,
        deskTake: comparison.deskTake,
        confidence: comparison.confidence,
        sourceCount: comparison.sources.length,
        sources: comparison.sources,
        signal: null,
        comparison,
      });
      if (!readIntelligenceShareToken(shareToken))
        throw new Error("Comparison share exceeds snapshot limits");
      return {
        status: "compared" as const,
        comparison,
        shareToken,
        anonymousRemaining: charged?.remaining ?? null,
      };
    } catch (error) {
      // Do not log user-entered markets, prompts or generated intelligence.
      console.error(
        "[markets] comparison failed",
        error instanceof Error ? error.name : "UnknownError"
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The Desk could not complete this comparison. Please try again.",
      });
    }
  }),
});
