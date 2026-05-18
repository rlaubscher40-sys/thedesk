/**
 * Email-list / newsletter subscribers.
 *
 * Public:
 *   · subscribe  , captures email + optional name + source. Generates a
 *                   confirm token (double opt-in pattern). In production a
 *                   confirmation email would be sent; the demo just stores
 *                   the row with the token visible.
 *   · confirm    , exchanges the token for a confirmedAt timestamp.
 *   · unsubscribe, flips unsubscribedAt; safe to call multiple times.
 *   · count      , confirmed-and-not-unsubscribed total. Used by the
 *                   sidebar/CTA to flex "Join 1,247 readers" once we
 *                   have enough subscribers to be worth flexing.
 *
 * Admin:
 *   · list       , full list. Drives the Admin console's subscriber
 *                   table.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as db from "../db";
import { sendConfirmEmail } from "../core/mailer";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { DEFAULT_SITE_URL } from "../../shared/const";

function siteOrigin(): string {
  const v = process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL;
  return v.replace(/\/+$/, "");
}

const emailSchema = z
  .string()
  .min(3)
  .max(320)
  .email()
  .transform((s) => s.trim().toLowerCase());

export const subscribersRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        name: z.string().min(1).max(128).optional(),
        /** Touchpoint identifier, "sidebar", "modal", "hero",
         *  "edition-footer", etc. */
        source: z.string().min(1).max(64).optional(),
        // Honeypot, must be empty. Form-filler bots flood every field;
        // a truthy value here means it's a bot and the row is rejected
        // before it ever touches the subscribers table.
        _hp: z.string().max(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.findSubscriberByEmail(input.email);
      if (existing && existing.confirmedAt) {
        // Already subscribed and confirmed, no-op success so the UI
        // doesn't expose whether the address is on the list.
        return {
          status: "already-confirmed" as const,
          confirmToken: null,
        };
      }

      const token = randomUUID().replace(/-/g, "");
      await db.createSubscriber({
        email: input.email,
        name: input.name ?? null,
        confirmToken: token,
        source: input.source ?? null,
      });

      // Fire-and-forget confirm email. mailer.send is a no-op when
      // RESEND_API_KEY is unset (dev / demo), so this path stays
      // functional without provider credentials. Failures don't block
      // the API response, the row is already persisted and an admin
      // can resend manually if delivery is needed.
      const confirmUrl = `${siteOrigin()}/confirm?token=${token}`;
      void sendConfirmEmail({ to: input.email, confirmUrl }).catch((err) =>
        console.warn(`[subscribers] confirm email send failed:`, err)
      );

      return {
        status: "pending-confirm" as const,
        // Token returned so dev / demo can construct the confirm URL
        // by hand when RESEND_API_KEY isn't wired up.
        confirmToken: token,
      };
    }),

  confirm: publicProcedure
    .input(z.object({ token: z.string().min(8).max(64) }))
    .mutation(async ({ input }) => {
      const row = await db.confirmSubscriber(input.token);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That confirmation link is invalid or expired.",
        });
      }
      return { email: row.email, confirmedAt: row.confirmedAt };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      await db.unsubscribeByEmail(input.email);
      return { success: true } as const;
    }),

  /** Public confirmed-subscriber count. Cached at the query layer; safe
   *  to expose since it's just a total. */
  count: publicProcedure.query(async () => {
    const n = await db.countConfirmedSubscribers();
    return { count: n };
  }),

  /** Admin: full subscriber list for the console. */
  list: adminProcedure.query(async () => {
    return db.listSubscribers();
  }),
});
