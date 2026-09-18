/**
 * Feedback inbox. Public submit endpoint behind a floating button on
 * every page; admin endpoints to list / mark reviewed / delete.
 *
 * No auth on submit, testers are mostly anonymous and asking for a
 * sign-in before they can leave feedback would lose 80% of them.
 * Simple rate-limit by user-agent length / message length / a basic
 * honeypot field would be a good follow-up if abuse becomes a problem.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { feedbackPageUrl } from "../../shared/feedbackPageUrl";
import {
  READER_TASK_KEYS,
  REQUEST_GEOGRAPHY_KEYS,
  REQUEST_OUTCOMES,
  REQUEST_TOPIC_KEYS,
  publishedAnswerPath,
} from "../../shared/readerRequests";

const submitInput = z.object({
  /**
   * "coverage" is a reader asking The Desk to report something, rather than
   * telling it about the site. It travels the same private inbox, with the
   * three categorisation fields below; nothing on this path is ever published
   * automatically. See shared/readerRequests.ts for the privacy rules.
   */
  kind: z.enum(["bug", "idea", "praise", "coverage"]),
  message: z.string().trim().min(3).max(2000),
  // Honeypot, the client never sets this. Form-filler bots will set
  // every field. A non-empty value here means it's a bot; reject.
  // Field name intentionally bland so signature-based bots can't spot
  // and skip it. Server treats any truthy value as spam.
  _hp: z.string().max(0).optional(),
  // Validate the URL parses AND uses an http(s) scheme. Belt + braces:
  // some URL validators accept "javascript:" as valid; the explicit
  // protocol check guarantees the admin can't be phished via a
  // malicious pageUrl clicked from the feedback inbox.
  pageUrl: z
    .string()
    .url()
    .max(512)
    .refine((u) => /^https?:\/\//i.test(u), {
      message: "pageUrl must be http(s)",
    })
    .optional()
    .nullable(),
  userAgent: z.string().max(512).optional().nullable(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  reporterLabel: z.string().max(128).optional().nullable(),
  // Fixed keys only. Free text here would be a second place a reader could put
  // a name or an address that triage then has to handle.
  topic: z
    .enum(REQUEST_TOPIC_KEYS as [string, ...string[]])
    .optional()
    .nullable(),
  geography: z
    .enum(REQUEST_GEOGRAPHY_KEYS as [string, ...string[]])
    .optional()
    .nullable(),
  readerTask: z
    .enum(READER_TASK_KEYS as [string, ...string[]])
    .optional()
    .nullable(),
});

export const feedbackRouter = router({
  /** Public: leave a feedback / bug / idea / praise note. */
  submit: publicProcedure.input(submitInput).mutation(async ({ input }) => {
    await db.createFeedback({
      kind: input.kind,
      message: input.message.trim(),
      pageUrl: feedbackPageUrl(input.pageUrl),
      userAgent: input.userAgent ?? null,
      contactEmail: input.contactEmail?.trim() || null,
      reporterLabel: input.reporterLabel?.trim() || null,
      // Categories belong to a coverage request. A bug report that arrives with
      // them set does not quietly become one.
      topic: input.kind === "coverage" ? (input.topic ?? null) : null,
      geography: input.kind === "coverage" ? (input.geography ?? null) : null,
      readerTask: input.kind === "coverage" ? (input.readerTask ?? null) : null,
    });
    return { ok: true } as const;
  }),

  /** Admin: list every submission, newest first. */
  list: adminProcedure.query(async () => db.listFeedback()),

  /** Admin-only: private inbox counts must not be publicly enumerable. */
  newCount: adminProcedure.query(async () => {
    return { count: await db.countNewFeedback() };
  }),

  /** Admin: flip status to reviewed (or back to new). */
  setStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "reviewed"]),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateFeedbackStatus(input.id, input.status);
      return { ok: true } as const;
    }),

  /**
   * Admin: record the outcome of a coverage request, and link the published
   * answer back to the request that prompted it.
   *
   * The answer must be a Desk published route. An arbitrary URL is refused
   * rather than stored, so the inbox cannot be used to get an outbound link
   * onto the site, and an outcome other than "answered" clears any link that
   * was there before.
   */
  setRequestOutcome: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(REQUEST_OUTCOMES),
        answerUrl: z.string().max(512).optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      // Only an answered request carries a link. Any other outcome clears it,
      // so a link cannot be left behind on a request that was later declined.
      const answerUrl = input.status === "answered" ? publishedAnswerPath(input.answerUrl) : null;
      if (input.status === "answered" && answerUrl === null)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An answered request needs a published Desk page, for example /story/1234.",
        });
      await db.recordRequestOutcome(input.id, input.status, answerUrl);
      return { ok: true } as const;
    }),

  /** Admin: delete a submission (spam, dupes, finished). */
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteFeedback(input.id);
      return { ok: true } as const;
    }),
});
