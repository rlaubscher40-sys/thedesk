import type { Express } from "express";
import { buildDailyBriefEmail, editionNotificationHtml } from "./mailer";
import { siteUrl } from "./siteUrl";

/** Render production templates without calling send, selecting subscribers or minting tokens. */
export function newsletterPreview(kind: "daily" | "sunday", base: string): string {
  const unsubscribeUrl = "#preview-unsubscribe";
  const html =
    kind === "daily"
      ? buildDailyBriefEmail({
          to: "preview@example.invalid",
          feedDate: "2026-09-18",
          siteUrl: base,
          unsubscribeUrl,
          items: [
            {
              id: 3960095,
              category: "Property",
              title: "AFG continues run with $1.2bn mortgage-backed securitisation",
              summary:
                "AFG Securities priced a $1.2 billion prime residential mortgage-backed securities transaction, expected to settle on 29 September. The funding deal does not establish the rate available to an individual borrower.",
            },
          ],
        }).html
      : editionNotificationHtml({
          greeting: null,
          editionNumber: 17,
          weekRange: "7–13 September 2026",
          editionUrl: `${base}/editions/17`,
          unsubscribeUrl,
        });
  const note = `<aside id="preview-unsubscribe" style="padding:20px;max-width:680px;margin:auto;font:16px/1.6 Georgia,serif;color:#29251f;background:#f5f0e7"><strong>Email preview · ${kind === "daily" ? "Daily brief" : "Sunday edition announcement"}</strong><p>A dated example in the current email template, not a record of an email sent. ${kind === "daily" ? "One published story is shown to demonstrate the layout; the daily selection and story count vary." : "The Sunday email links to the edition; the full edition is read on the website."} No email has been sent. This preview’s unsubscribe link returns here; real emails include your personal unsubscribe link.</p><a href="/subscribe">Return to subscription details →</a></aside>`;
  return html.replace(/(<body[^>]*>)/i, `$1${note}`);
}
export function registerNewsletterPreviews(app: Express) {
  for (const kind of ["daily", "sunday"] as const)
    app.get(`/newsletter-preview/${kind}`, (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.set("X-Robots-Tag", "noindex");
      res.type("html").send(newsletterPreview(kind, siteUrl()));
    });
}
