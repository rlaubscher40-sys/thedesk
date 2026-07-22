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
import { isDemoMode } from "../demo/store";
import {
  sendConfirmEmail,
  sendAlreadyConfirmedEmail,
  sendDailyBriefEmail,
  sendLeadMagnetEmail,
  editionUnsubscribeUrl,
} from "../core/mailer";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import { DEFAULT_SITE_URL, isEnrichedChannel } from "../../shared/const";
import { getLeadMagnet } from "../../shared/leadMagnets";

function todayAEST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

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
      if (existing?.confirmedAt && !existing.unsubscribedAt) {
        // Already confirmed. Send a quiet nudge so the subscriber knows
        // they're on the list (covers the case where an email security
        // scanner auto-clicked their confirm link without them realising).
        // The API response is deliberately indistinguishable from the
        // fresh-subscribe case: a distinct "already-confirmed" status would
        // let anyone probe whether an address is on the list. The real
        // answer goes to the inbox owner, not the caller.
        const origin = siteOrigin();
        void sendAlreadyConfirmedEmail({
          to: input.email,
          editionsUrl: `${origin}/editions`,
        }).catch((err) => console.warn(`[subscribers] already-confirmed nudge failed:`, err));
        return {
          status: "pending-confirm" as const,
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
      // The confirm page is mounted at /confirm-subscription in
      // App.tsx; the email's CTA links here. Don't change the path
      // without also updating the React route, or the link 404s.
      const confirmUrl = `${siteOrigin()}/confirm-subscription?token=${token}`;
      void sendConfirmEmail({ to: input.email, confirmUrl }).catch((err) =>
        console.warn(`[subscribers] confirm email send failed:`, err)
      );

      return {
        status: "pending-confirm" as const,
        // Token returned ONLY outside production so dev / demo can construct
        // the confirm URL by hand when RESEND_API_KEY isn't wired up. In
        // production it must never leave the server: handing it to the
        // caller would let anyone subscribe AND confirm someone else's
        // address without ever seeing their inbox, defeating double opt-in.
        confirmToken: isDemoMode() || process.env.NODE_ENV !== "production" ? token : null,
      };
    }),

  /**
   * Request a gated lead magnet. Upserts the email (source "magnet:<slug>")
   * and emails a link that, when clicked, confirms the address and redirects
   * to the asset. An already-confirmed subscriber skips the confirm step and
   * gets the asset link directly. The response is uniform regardless of
   * whether the address already existed, for the same reason `subscribe` is:
   * it must not leak who is on the list.
   */
  requestLeadMagnet: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        slug: z.string().min(1).max(64),
        _hp: z.string().max(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const magnet = getLeadMagnet(input.slug);
      if (!magnet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That resource doesn't exist." });
      }
      const origin = siteOrigin();
      const assetUrl = magnet.deliveryUrl.startsWith("http")
        ? magnet.deliveryUrl
        : `${origin}${magnet.deliveryUrl}`;
      const buttonLabel = `Download ${magnet.assetNoun}`;

      const existing = await db.findSubscriberByEmail(input.email);
      if (existing?.confirmedAt && !existing.unsubscribedAt) {
        // Already on the list — no confirm needed. Send the asset straight,
        // no token, so a known reader isn't asked to re-verify.
        void sendLeadMagnetEmail({
          to: input.email,
          title: magnet.title,
          deliverUrl: assetUrl,
          buttonLabel,
        }).catch((err) => console.warn(`[lead-magnet] direct send failed:`, err));
        return { status: "sent" as const, token: null };
      }

      const token = randomUUID().replace(/-/g, "");
      await db.createSubscriber({
        email: input.email,
        name: null,
        confirmToken: token,
        source: `magnet:${input.slug}`,
      });

      const deliverUrl = `${origin}/api/magnet/${input.slug}?token=${token}`;
      void sendLeadMagnetEmail({
        to: input.email,
        title: magnet.title,
        deliverUrl,
        buttonLabel,
      }).catch((err) => console.warn(`[lead-magnet] confirm send failed:`, err));

      return {
        status: "sent" as const,
        // Dev/demo only, so the flow can be walked without a mail provider —
        // never in production, where handing back the token would let a
        // caller confirm someone else's address (see `subscribe`).
        token: isDemoMode() || process.env.NODE_ENV !== "production" ? token : null,
      };
    }),

  confirm: publicProcedure
    .input(z.object({ token: z.string().min(8).max(64) }))
    .mutation(async ({ input }) => {
      const result = await db.confirmSubscriber(input.token);
      if (result.status === "expired") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          // Distinct from "invalid" so the confirm page can offer a resubscribe
          // path rather than implying the link was never real.
          message:
            "That confirmation link has expired. Subscribe again and we'll send a fresh one.",
        });
      }
      if (result.status === "not-found") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That confirmation link is invalid.",
        });
      }
      return {
        email: result.subscriber.email,
        confirmedAt: result.subscriber.confirmedAt,
      };
    }),

  // NOTE: there is deliberately no public unsubscribe-by-email mutation here.
  // Unsubscribing requires the HMAC-signed link from an email footer
  // (/api/unsubscribe, see server/core/unsubscribeRoute.ts) so that only
  // someone with access to the inbox can remove the address. A bare-email
  // mutation let anyone silently unsubscribe any subscriber.

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

  /** Admin: resend today's daily brief to a single confirmed subscriber. */
  resendDailyBrief: adminProcedure
    .input(z.object({ subscriberId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const subs = await db.listSubscribers();
      const sub = subs.find((s) => s.id === input.subscriberId);
      if (!sub || !sub.confirmedAt || sub.unsubscribedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found or not active." });
      }
      const today = todayAEST();
      // Partner-facing email: enriched lanes (AU + Property) only, matching the
      // scheduled daily brief. Coverage tabs don't go to a partner's inbox.
      const items = (await db.listFeedItems(today)).filter((it) => isEnrichedChannel(it.channel));
      if (items.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No feed items for today yet.",
        });
      }
      const origin = siteOrigin();
      const result = await sendDailyBriefEmail({
        to: sub.email,
        name: sub.name,
        items: items.slice(0, 5),
        feedDate: today,
        siteUrl: origin,
        unsubscribeUrl: editionUnsubscribeUrl(sub.email, origin),
      });
      if (result.delivered) {
        await db.markDailyBriefSent([sub.id], today);
      }
      return { delivered: result.delivered };
    }),
});
