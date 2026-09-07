import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { consumeAnonymousAsk, consumeAnonymousCard } from "../core/askQuota";
import { invokeLLMJson } from "../core/llm";
import { renderIntelligenceCard } from "../og/intelligenceCard";
import { publicProcedure, router } from "../core/trpc";
import {
  askDeskResponseFormat,
  buildAskDeskMessages,
  type AskContextSource,
} from "../prompts/ask";

const signalSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(80),
  context: z.string().min(1).max(220),
});

const askAnswerSchema = z.object({
  headline: z.string().min(1).max(220),
  answer: z.string().min(1).max(2600),
  whyItMatters: z.string().min(1).max(1800),
  deskTake: z.string().min(1).max(1800),
  whatWouldChangeOurMind: z.string().min(1).max(1800),
  signals: z.array(signalSchema).max(4),
  sourceRefs: z.array(z.number().int().positive()).min(1).max(8),
  confidence: z.enum(["high", "medium", "low"]),
});

type SearchBundle = Awaited<ReturnType<typeof db.searchAllContent>>;
type FeedSearchRow = SearchBundle["feedItems"][number];
type EditionSearchRow = SearchBundle["editions"][number];

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "australia",
  "australian",
  "because",
  "before",
  "being",
  "could",
  "does",
  "from",
  "have",
  "into",
  "market",
  "property",
  "should",
  "their",
  "there",
  "these",
  "thing",
  "think",
  "this",
  "those",
  "what",
  "when",
  "where",
  "which",
  "would",
  "with",
]);

function searchTerms(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const unique = [...new Set(words)];
  // Longer terms tend to carry more retrieval meaning (Townsville, migration,
  // approvals) than short glue words. Keep the request bounded because each
  // term is one indexed archive lookup.
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, 7);
}

function compactText(parts: Array<string | null | undefined>, limit = 2600): string {
  const text = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function sourceDate(value: Date | string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

async function retrieve(question: string): Promise<{
  feed: FeedSearchRow[];
  editions: EditionSearchRow[];
}> {
  const terms = searchTerms(question);
  const queries = [...new Set([question.trim(), ...terms])].slice(0, 8);
  const bundles = await Promise.all(queries.map((query) => db.searchAllContent(query)));

  const feed = new Map<number, FeedSearchRow>();
  const editions = new Map<number, EditionSearchRow>();

  for (const bundle of bundles) {
    for (const row of bundle.feedItems) {
      if (!feed.has(row.id)) feed.set(row.id, row);
    }
    for (const row of bundle.editions) {
      if (!editions.has(row.id)) editions.set(row.id, row);
    }
  }

  return {
    feed: [...feed.values()].slice(0, 10),
    editions: [...editions.values()].slice(0, 5),
  };
}

function enforceAnonymousQuota(
  authenticated: boolean,
  consume: () => { allowed: boolean; remaining: number; limit: number }
): number | null {
  if (authenticated) return null;
  const quota = consume();
  if (!quota.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You've used today's ${quota.limit} free Ask The Desk questions. Sign in to keep going.`,
    });
  }
  return quota.remaining;
}

export const askRouter = router({
  answer: publicProcedure
    .input(
      z.object({
        question: z.string().trim().min(3).max(240),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const matches = await retrieve(input.question);

      if (matches.feed.length === 0 && matches.editions.length === 0) {
        return {
          status: "insufficient" as const,
          question: input.question,
          message:
            "The Desk does not have enough archive evidence to answer that yet. Try a market, policy, lender, migration, supply or lending question already covered in the brief.",
          sources: [],
          anonymousRemaining: null,
        };
      }

      const evidence: AskContextSource[] = [];
      const sourceMeta: Array<{
        ref: number;
        kind: "feed" | "edition";
        title: string;
        date: string;
        category: string | null;
        href: string;
        publisher: string | null;
        externalUrl: string | null;
      }> = [];

      for (const item of matches.feed) {
        const ref = evidence.length + 1;
        const text = compactText([
          item.summary,
          item.whyItMatters,
          item.sayThis,
          item.counterpoint,
          item.rubensNote,
          item.snippet,
        ]);
        if (!text) continue;
        evidence.push({
          ref,
          kind: "feed",
          title: item.title,
          date: item.feedDate,
          category: item.category,
          text,
        });
        sourceMeta.push({
          ref,
          kind: "feed",
          title: item.title,
          date: item.feedDate,
          category: item.category,
          href: `/story/${item.id}`,
          publisher: item.source ?? null,
          externalUrl: item.sourceUrl ?? null,
        });
      }

      for (const edition of matches.editions) {
        const ref = evidence.length + 1;
        const text = compactText([edition.fullText, edition.rubensTake, edition.snippet], 3200);
        if (!text) continue;
        evidence.push({
          ref,
          kind: "edition",
          title: `Edition ${edition.editionNumber}: ${edition.weekRange}`,
          date: sourceDate(edition.publishedAt, edition.weekOf),
          category: null,
          text,
        });
        sourceMeta.push({
          ref,
          kind: "edition",
          title: `Edition ${edition.editionNumber}: ${edition.weekRange}`,
          date: sourceDate(edition.publishedAt, edition.weekOf),
          category: null,
          href: `/editions/${edition.editionNumber}`,
          publisher: "The Desk",
          externalUrl: null,
        });
      }

      if (evidence.length === 0) {
        return {
          status: "insufficient" as const,
          question: input.question,
          message: "The Desk found related records, but not enough usable evidence to answer reliably.",
          sources: [],
          anonymousRemaining: null,
        };
      }

      // Retrieval is cheap; only consume a public allowance once we are about
      // to spend an LLM call. Signed-in readers are not metered here.
      const anonymousRemaining = enforceAnonymousQuota(
        Boolean(ctx.user),
        () => consumeAnonymousAsk(ctx.req)
      );

      let parsed: z.infer<typeof askAnswerSchema>;
      try {
        const raw = await invokeLLMJson<unknown>({
          messages: buildAskDeskMessages(input.question, evidence),
          responseFormat: askDeskResponseFormat,
          maxTokens: 2200,
          tier: "standard",
          thinking: false,
        });
        parsed = askAnswerSchema.parse(raw);
      } catch (error) {
        console.error("[ask] intelligence answer failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not build a grounded answer. Try again in a moment.",
        });
      }

      const validRefs = new Set(evidence.map((source) => source.ref));
      const selectedRefs = [...new Set(parsed.sourceRefs)].filter((ref) => validRefs.has(ref));
      if (selectedRefs.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk answer failed its source check. Try again.",
        });
      }

      const selected = new Set(selectedRefs);
      return {
        status: "answered" as const,
        question: input.question,
        answer: { ...parsed, sourceRefs: selectedRefs },
        sources: sourceMeta.filter((source) => selected.has(source.ref)),
        searchedRecords: evidence.length,
        anonymousRemaining,
      };
    }),

  /**
   * Turn an already-grounded Ask answer into a native 4:5 distribution asset.
   * Anonymous rendering has its own CPU quota; signed-in readers are unlimited.
   */
  shareCard: publicProcedure
    .input(
      z.object({
        question: z.string().trim().min(3).max(240),
        headline: z.string().trim().min(1).max(220),
        answer: z.string().trim().min(1).max(1200),
        deskTake: z.string().trim().min(1).max(900),
        confidence: z.enum(["high", "medium", "low"]),
        sourceCount: z.number().int().min(1).max(20),
        signal: signalSchema.nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      enforceAnonymousQuota(Boolean(ctx.user), () => consumeAnonymousCard(ctx.req));
      try {
        const png = await renderIntelligenceCard({
          question: input.question,
          headline: input.headline,
          answer: input.answer,
          deskTake: input.deskTake,
          confidence: input.confidence,
          sourceCount: input.sourceCount,
          signal: input.signal ?? null,
        });
        return {
          mimeType: "image/png" as const,
          filename: "the-desk-intelligence.png",
          base64: png.toString("base64"),
        };
      } catch (error) {
        console.error("[ask] intelligence card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render the share card.",
        });
      }
    }),
});
