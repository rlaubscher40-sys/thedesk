/**
 * Feedback inbox. Public submit endpoint behind a floating button on
 * every page; admin endpoints to list / mark reviewed / delete.
 *
 * No auth on submit, testers are mostly anonymous and asking for a
 * sign-in before they can leave feedback would lose 80% of them.
 * Simple rate-limit by user-agent length / message length / a basic
 * honeypot field would be a good follow-up if abuse becomes a problem.
 */
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, publicProcedure, router } from "../core/trpc";

const submitInput = z.object({
  kind: z.enum(["bug", "idea", "praise"]),
  message: z.string().min(3).max(2000),
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
});

export const feedbackRouter = router({
  /** Public: leave a feedback / bug / idea / praise note. */
  submit: publicProcedure.input(submitInput).mutation(async ({ input }) => {
    await db.createFeedback({
      kind: input.kind,
      message: input.message.trim(),
      pageUrl: input.pageUrl ?? null,
      userAgent: input.userAgent ?? null,
      contactEmail: input.contactEmail?.trim() || null,
      reporterLabel: input.reporterLabel?.trim() || null,
    });
    return { ok: true } as const;
  }),

  /** Admin: list every submission, newest first. */
  list: adminProcedure.query(async () => db.listFeedback()),

  /** Public: how many "new" entries, used to badge the admin nav. */
  newCount: publicProcedure.query(async () => {
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

  /** Admin: delete a submission (spam, dupes, finished). */
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteFeedback(input.id);
      return { ok: true } as const;
    }),
});
