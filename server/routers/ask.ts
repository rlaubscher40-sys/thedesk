import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { displayMetricValue, rankAskMetrics } from "../ask/metricRetrieval";
import { askQueryTerms, rankAskRecords } from "../ask/relevance";
import { retrieveLocalFacts } from "../ask/localFacts";
import { describeMetricObservation } from "../../shared/metricObservation";
import * as db from "../db";
import {
  consumeAnonymousAskAttempt,
  reserveAnonymousAsk,
  consumeAnonymousCard,
} from "../core/askQuota";
import { ASK_SERVER_TIMEOUT_MS, DeadlineError, withDeadline } from "../../shared/requestDeadline";
import {
  createIntelligenceShareToken,
  readIntelligenceShareToken,
} from "../core/intelligenceShare";
import { invokeLLMJson } from "../core/llm";
import { renderIntelligenceCard } from "../core/publicRender";
import { publicProcedure, router } from "../core/trpc";
import { askDeskResponseFormat, buildAskDeskMessages, type AskContextSource } from "../prompts/ask";

const signalSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(80),
  context: z.string().min(1).max(220),
});

const askAnswerSchema = z.object({
  status: z.literal("answered"),
  headline: z.string().min(1).max(220),
  answer: z.string().min(1).max(2600),
  whyItMatters: z.string().min(1).max(1800),
  deskTake: z.string().min(1).max(1800),
  whatWouldChangeOurMind: z.string().min(1).max(1800),
  signals: z.array(signalSchema).max(4),
  sourceRefs: z.array(z.number().int().positive()).min(1).max(8),
  confidence: z.enum(["high", "medium", "low"]),
});

const askResponseSchema = z.discriminatedUnion("status", [
  askAnswerSchema,
  z.object({
    status: z.literal("insufficient"),
    reason: z.string().trim().min(1).max(600),
    relatedSourceRefs: z.array(z.number().int().positive()).max(3).default([]),
  }),
]);

type SearchBundle = Awaited<ReturnType<typeof db.searchAllContent>>;
type FeedSearchRow = SearchBundle["feedItems"][number];
type EditionSearchRow = SearchBundle["editions"][number];
type MetricRow = Awaited<ReturnType<typeof db.listDailyMetrics>>[number];

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
  archive: Awaited<ReturnType<typeof db.searchPropertyEvidence>>;
  editions: EditionSearchRow[];
  metrics: MetricRow[];
  facts: Awaited<ReturnType<typeof retrieveLocalFacts>>;
}> {
  const terms = askQueryTerms(question).slice(0, 7);
  const queries = [...new Set([question.trim(), ...terms])].slice(0, 8);
  const [bundles, allMetrics, archiveBundles, facts] = await Promise.all([
    Promise.all(queries.map((query) => db.searchAllContent(query))),
    db.listDailyMetrics(),
    Promise.all(queries.map((query) => db.searchPropertyEvidence(query))),
    retrieveLocalFacts(question),
  ]);

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

  const archiveRows = [
    ...new Map(archiveBundles.flat().map((row) => [row.identity, row])).values(),
  ];
  const feedUrls = new Set([...feed.values()].map((row) => row.sourceUrl));
  const feedTitles = new Set([...feed.values()].map((row) => row.title.trim().toLowerCase()));
  return {
    facts,
    archive: rankAskRecords(
      question,
      archiveRows.filter(
        (row) => !feedUrls.has(row.sourceUrl) && !feedTitles.has(row.title.trim().toLowerCase())
      ),
      {
        title: (row) => row.title,
        body: (row) => row.summary,
        date: (row) => row.publishedAt.toISOString(),
      },
      8
    ),
    feed: rankAskRecords(
      question,
      [...feed.values()],
      {
        title: (item) => item.title,
        body: (item) => [item.summary, item.whyItMatters, item.snippet].filter(Boolean).join(" "),
        date: (item) => item.feedDate,
      },
      10
    ),
    editions: rankAskRecords(
      question,
      [...editions.values()],
      {
        title: (edition) => `Edition ${edition.editionNumber}: ${edition.weekRange}`,
        body: (edition) =>
          [edition.fullText, edition.rubensTake, edition.snippet].filter(Boolean).join(" "),
        date: (edition) => edition.weekOf,
      },
      5
    ),
    metrics: rankAskMetrics(question, allMetrics, 6),
  };
}

async function enforceAnonymousQuota(
  authenticated: boolean,
  consume: () => Promise<{ allowed: boolean; remaining: number; limit: number }>
): Promise<number | null> {
  if (authenticated) return null;
  const quota = await consume();
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
      const reservation: { current: Awaited<ReturnType<typeof reserveAnonymousAsk>> | null } = {
        current: null,
      };
      try {
        const result = await withDeadline(async (signal) => {
          const matches = await retrieve(input.question);

          if (
            matches.archive.length === 0 &&
            matches.feed.length === 0 &&
            matches.editions.length === 0 &&
            matches.metrics.length === 0 && matches.facts.length === 0
          ) {
            return {
              status: "insufficient" as const,
              question: input.question,
              message:
                "The Desk does not have enough evidence to answer that yet. Try a market, policy, lender, migration, supply or lending question already covered in the brief.",
              sources: [],
              anonymousRemaining: null,
            };
          }

          const evidence: AskContextSource[] = [];
          const sourceMeta: Array<{
            ref: number;
            kind: "feed" | "edition" | "metric";
            title: string;
            date: string;
            category: string | null;
            href: string;
            publisher: string | null;
            externalUrl: string | null;
          }> = [];

          for (const fact of matches.facts) {
            const ref = evidence.length + 1;
            evidence.push({ref, kind: "metric", title: fact.title, date: fact.date, category: "LOCAL DATA", text: fact.text});
            sourceMeta.push({ref, kind: "metric", title: fact.title, date: fact.date, category: "LOCAL DATA", href: fact.href, publisher: fact.publisher, externalUrl: fact.sourceUrl});
          }

          for (const metric of matches.metrics) {
            const ref = evidence.length + 1;
            const currentValue = displayMetricValue(metric.value, metric.unit);
            const previousValue = metric.previousValue
              ? displayMetricValue(metric.previousValue, metric.unit)
              : null;
            const observation = describeMetricObservation(metric);
            const date = observation.date ?? "Observation date unavailable";
            const text = compactText([
              `Stored observation: ${currentValue}`,
              `Reporting status: ${observation.explanation}`,
              previousValue ? `Previous recorded value: ${previousValue}` : null,
              metric.context ? `Context: ${metric.context}` : null,
              metric.source ? `Source: ${metric.source}` : null,
              metric.groupKey ? `Metric group: ${metric.groupKey}` : null,
              `As of: ${date}`,
            ]);
            evidence.push({
              ref,
              kind: "metric",
              title: `${metric.label}: ${currentValue}`,
              date,
              category: metric.groupKey,
              text,
            });
            sourceMeta.push({
              ref,
              kind: "metric",
              title: `${metric.label}: ${currentValue}`,
              date,
              category: metric.groupKey,
              href: "/trends",
              publisher: metric.source ?? "The Desk metrics",
              externalUrl: metric.sourceUrl ?? null,
            });
          }

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

          for (const item of matches.archive) {
            const ref = evidence.length + 1;
            const date = item.publishedAt.toISOString().slice(0, 10);
            evidence.push({
              ref,
              kind: "feed",
              title: item.title,
              date,
              category: "PROPERTY",
              text: `Public feed excerpt only; the full article has not been verified. ${item.summary || item.title}`,
            });
            sourceMeta.push({
              ref,
              kind: "feed",
              title: item.title,
              date,
              category: "PROPERTY",
              href: `/evidence/${item.id}`,
              publisher: item.source,
              externalUrl: item.sourceUrl,
            });
          }

          for (const edition of matches.editions) {
            const ref = evidence.length + 1;
            // Preserve the matched passage even when a long edition is clipped.
            const text = compactText([edition.snippet, edition.fullText, edition.rubensTake], 3200);
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
              message:
                "The Desk found related records, but not enough usable evidence to answer reliably.",
              sources: [],
              anonymousRemaining: null,
            };
          }

          // A direct numeric lookup with only withheld local values needs no
          // model interpretation. In particular, contextual bond counts do not
          // establish why the publisher suppressed a median.
          if (
            /\b(?:median|weekly)\b/i.test(input.question) &&
            /\b(?:rent|rents|rental)\b/i.test(input.question) &&
            matches.facts.length > 0 &&
            matches.facts.every((fact) => fact.withheldRent === true)
          ) {
            return {
              status: "insufficient" as const,
              question: input.question,
              message: "The matching local rent values are withheld or suppressed for the reporting periods shown in the sources. No numeric rent is available for the requested category. The records do not establish a reason beyond their stated suppression or sample-size status. A different category, place or period would not answer the same question.",
              sources: sourceMeta.slice(0, Math.min(matches.facts.length, 3)),
              anonymousRemaining: null,
            };
          }

          signal.throwIfAborted();
          if (!ctx.user) {
            reservation.current = await reserveAnonymousAsk(ctx.req);
            if (signal.aborted) {
              await reservation.current.release();
              signal.throwIfAborted();
            }
            if (!reservation.current.allowed) {
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message:
                  "You've used today's 3 free questions, or they are still processing. Sign in to keep going.",
              });
            }
            if (!(await consumeAnonymousAskAttempt(ctx.req)).allowed) {
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message:
                  "You've reached today's retry limit. Your unanswered questions have not used your free answer allowance. Try tomorrow or sign in to continue.",
              });
            }
          }
          const anonymousRemaining = reservation.current?.remaining ?? null;

          let parsed: z.infer<typeof askAnswerSchema>;
          try {
            const raw = await invokeLLMJson<unknown>({
              messages: buildAskDeskMessages(input.question, evidence),
              responseFormat: askDeskResponseFormat,
              maxTokens: 2200,
              tier: "standard",
              thinking: false,
              signal,
            });
            signal.throwIfAborted();
            const response = askResponseSchema.parse(raw);
            if (response.status === "insufficient") {
              return {
                status: "insufficient" as const,
                question: input.question,
                message: response.reason,
                // Only offer useful follow-up reading; generic keyword matches
                // should not become recommendations just by arriving first.
                sources: sourceMeta.filter((source) =>
                  response.relatedSourceRefs.includes(source.ref)
                ),
                anonymousRemaining: null,
              };
            }
            parsed = response;
          } catch (error) {
            signal.throwIfAborted();
            console.error("[ask] intelligence answer failed", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "The Desk could not build a grounded answer. Try again in a moment.",
            });
          }

          const validRefs = new Set(evidence.map((source) => source.ref));
          const selectedRefs = [...new Set(parsed.sourceRefs)].filter((ref) => validRefs.has(ref));
          if (
            selectedRefs.length === 0 ||
            selectedRefs.length !== new Set(parsed.sourceRefs).size
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "The Desk answer failed its source check. Try again.",
            });
          }

          const selected = new Set(selectedRefs);
          const selectedSources = sourceMeta.filter((source) => selected.has(source.ref));
          // Mint the public-share token here, after retrieval + source validation.
          // The later image-render endpoint accepts this token rather than browser
          // supplied prose, so nobody can ask our server to sign an arbitrary claim
          // as a Desk intelligence brief.
          const shareToken = createIntelligenceShareToken({
            question: input.question,
            headline: parsed.headline,
            answer: parsed.answer,
            deskTake: parsed.deskTake,
            confidence: parsed.confidence,
            sourceCount: selectedSources.length,
            sources: selectedSources.map((source) => ({
              title: source.title,
              date: source.date,
              publisher: source.publisher,
              href: source.href,
            })),
            signal: parsed.signals[0] ?? null,
          });

          return {
            status: "answered" as const,
            question: input.question,
            answer: { ...parsed, sourceRefs: selectedRefs },
            sources: selectedSources,
            searchedRecords: evidence.length,
            anonymousRemaining,
            shareToken,
          };
        }, ASK_SERVER_TIMEOUT_MS);
        if (result.status === "answered") reservation.current?.commit();
        return result;
      } catch (error) {
        if (error instanceof DeadlineError) {
          throw new TRPCError({ code: "TIMEOUT", message: error.message });
        }
        throw error;
      } finally {
        // Also runs on deadline: late work cannot consume or commit the reservation.
        await reservation.current?.release();
      }
    }),

  /** Public read endpoint for a server-issued, signed intelligence snapshot. */
  shared: publicProcedure
    .input(z.object({ token: z.string().min(20).max(16_000) }))
    .query(({ input }) => {
      const brief = readIntelligenceShareToken(input.token);
      if (!brief) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This intelligence brief is invalid or has expired.",
        });
      }
      return brief;
    }),

  /**
   * Render a native 4:5 distribution asset from a server-issued Ask token.
   * Crucially, no answer/headline/source fields are accepted from the browser:
   * the signed token freezes the already-grounded answer and evidence list.
   */
  shareCard: publicProcedure
    .input(z.object({ token: z.string().min(20).max(16_000) }))
    .mutation(async ({ input, ctx }) => {
      await enforceAnonymousQuota(Boolean(ctx.user), () => consumeAnonymousCard(ctx.req));
      const brief = readIntelligenceShareToken(input.token);
      if (!brief) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This intelligence share is invalid or has expired.",
        });
      }

      try {
        const png = await renderIntelligenceCard({
          question: brief.question,
          headline: brief.headline,
          answer: brief.answer,
          deskTake: brief.deskTake,
          confidence: brief.confidence,
          sourceCount: brief.sourceCount,
          signal: brief.signal,
          comparison: brief.comparison,
        });
        return {
          mimeType: "image/png" as const,
          filename: "the-desk-intelligence.png",
          base64: png.toString("base64"),
          sharePath: `/brief?t=${encodeURIComponent(input.token)}`,
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
