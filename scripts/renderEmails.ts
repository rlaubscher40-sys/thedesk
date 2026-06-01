/**
 * Dev-only: render every mailer template to an HTML file so the navy
 * surface can be eyeballed in a browser before sending. Stubs global
 * fetch so the Resend call is captured, not made.
 *
 *   tsx scripts/renderEmails.ts   → writes to /tmp/email-previews/*.html
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  sendConfirmEmail,
  sendAlreadyConfirmedEmail,
  sendEditionNotificationEmail,
  sendDailyBriefEmail,
  sendWeeklyRecapEmail,
  sendTalkingPointNudgeEmail,
} from "../server/core/mailer.ts";

const OUT = "/tmp/email-previews";
mkdirSync(OUT, { recursive: true });

process.env.RESEND_API_KEY = "preview-stub";
process.env.MAIL_FROM = "The Desk <hello@thedesk.au>";

const captured: Array<{ subject: string; html: string }> = [];
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const payload = JSON.parse(init.body) as { subject: string; html: string };
  captured.push(payload);
  return { ok: true, json: async () => ({ id: "preview" }) } as Response;
}) as typeof fetch;

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

async function run() {
  await sendConfirmEmail({ to: "you@example.com", confirmUrl: "https://thedesk.au/confirm?t=demo" });

  await sendAlreadyConfirmedEmail({ to: "you@example.com", editionsUrl: "https://thedesk.au/editions" });

  await sendEditionNotificationEmail({
    to: "you@example.com",
    name: "Ruben Laubscher",
    editionNumber: 12,
    weekRange: "26 May – 1 June",
    editionUrl: "https://thedesk.au/edition/12",
    unsubscribeUrl: "https://thedesk.au/api/unsubscribe?demo",
  });

  await sendDailyBriefEmail({
    to: "you@example.com",
    name: "Ruben Laubscher",
    feedDate: "2026-06-02",
    siteUrl: "https://thedesk.au",
    unsubscribeUrl: "https://thedesk.au/api/unsubscribe?demo",
    items: [
      {
        id: 1,
        title: "This week could be a test for Labor — but only if the Coalition asks the right questions",
        category: "Policy",
        whyItMatters:
          "Estimates will scrutinise negative gearing, CGT, NDIS cuts and AUKUS sub costs, but the Greens, not the Coalition, decide what budget measures actually pass.",
        summary: "",
      },
      {
        id: 2,
        title: "Breaking: NDAs to be waived for landmark military sexual violence inquiry",
        category: "Markets",
        whyItMatters:
          "Gag orders imposed on former and current Defence personnel who experienced sexual violence will not be enforced, allowing them to participate in a landmark inquiry.",
        summary: "",
      },
      {
        id: 3,
        title: "RBA holds the cash rate as housing credit growth ticks up",
        category: "Economy",
        whyItMatters:
          "Steady rates plus rising credit growth means more buyers re-enter the market this winter — relevant for any partnership conversation about pipeline.",
        summary: "",
      },
    ],
  });

  await sendWeeklyRecapEmail({
    to: "you@example.com",
    name: "Ruben Laubscher",
    weekRange: "26 May – 1 June",
    storyCount: 28,
    thisWeekUrl: "https://thedesk.au/this-week",
    unsubscribeUrl: "https://thedesk.au/api/unsubscribe?demo",
    talkingPoints: [
      {
        title: "Negative gearing back on the Estimates agenda",
        category: "Policy",
        sayThis: "Estimates week is when the real numbers surface — worth watching before any tax-strategy chat.",
      },
      {
        title: "Housing credit growth ticks up despite the hold",
        category: "Economy",
        sayThis: "Steady rates plus rising credit means buyers are re-entering — your pipeline may move sooner than expected.",
      },
    ],
  });

  await sendTalkingPointNudgeEmail({
    to: "you@example.com",
    storyTitle: "Negative gearing back on the Estimates agenda",
    category: "Policy",
    sayThis: "Estimates week is when the real numbers surface — worth watching before any tax-strategy chat.",
    yesUrl: "https://thedesk.au/api/nudge/respond?demo&result=yes",
    notYetUrl: "https://thedesk.au/api/nudge/respond?demo&result=not-yet",
  });

  for (const { subject, html } of captured) {
    const file = `${OUT}/${slug(subject)}.html`;
    writeFileSync(file, html, "utf8");
    console.log(`wrote ${file}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
