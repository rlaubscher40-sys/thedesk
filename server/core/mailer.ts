/**
 * Minimal mailer over the Resend REST API.
 *
 * No SDK dep. Reads `RESEND_API_KEY` and `MAIL_FROM` from env. When the
 * key is unset (dev, demo mode), `send()` logs the message to stdout
 * and returns `{ delivered: false, reason: "no-key" }` instead of
 * throwing, so the subscribe flow stays functional locally.
 *
 * Templates are inline HTML strings that lean on the same brand
 * surface as the masthead: D-Sunrise mark, Playfair "The Desk"
 * wordmark, INTELLIGENCE byline, mid-dot separators. Kept compact so
 * the message renders consistently across Gmail, Outlook, Apple Mail.
 */

import { createHmac } from "node:crypto";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendResult =
  | { delivered: true; id: string }
  | { delivered: false; reason: "no-key" | "api-error"; detail?: string };

export async function send(input: SendInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "The Desk <hello@thedesk.au>";

  if (!apiKey) {
    console.log(
      `[mailer] no RESEND_API_KEY set, dry-run send to ${input.to}: ${input.subject}`
    );
    return { delivered: false, reason: "no-key" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      console.warn(`[mailer] resend ${res.status}: ${detail}`);
      return { delivered: false, reason: "api-error", detail };
    }
    const body = (await res.json()) as { id?: string };
    return { delivered: true, id: body.id ?? "" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[mailer] resend send failed: ${detail}`);
    return { delivered: false, reason: "api-error", detail };
  }
}

/** Brand-styled subscribe-confirmation email. */
export async function sendConfirmEmail({
  to,
  confirmUrl,
}: {
  to: string;
  confirmUrl: string;
}): Promise<SendResult> {
  const html = confirmEmailHtml({ confirmUrl });
  const text = [
    "The Desk · Intelligence",
    "",
    "Confirm your subscription.",
    "",
    "Tap the link below to lock in your subscription. It expires in 24 hours.",
    "",
    confirmUrl,
    "",
    "If you didn't ask for this, ignore the message and nothing happens.",
    "",
    "The Desk · Daily intelligence for property partnerships",
    "Curated by Ruben Laubscher.",
  ].join("\n");
  return send({
    to,
    subject: "Confirm your subscription · The Desk",
    html,
    text,
  });
}

export function editionUnsubscribeUrl(email: string, siteOrigin: string): string {
  const sig = createHmac("sha256", process.env.JWT_SECRET ?? "dev")
    .update(email)
    .digest("base64url");
  return `${siteOrigin}/api/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
}

/** Sent when someone re-subscribes with an already-confirmed address.
 *  Lets them know they're already on the list (common when an email security
 *  scanner silently consumed their original confirm link). */
export async function sendAlreadyConfirmedEmail({
  to,
  editionsUrl,
}: {
  to: string;
  editionsUrl: string;
}): Promise<SendResult> {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";

  const html = `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>You're already on the list</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;background-color:${NAVY};">
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">Already confirmed</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:32px;line-height:1.05;color:${FG};margin:0 0 16px;letter-spacing:-0.02em;">You're already on the list.</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 24px;">This address is already confirmed and receiving The Desk. Your email client may have automatically clicked the original confirmation link — that's a safety feature some providers use, not an error on your end. You won't miss a thing.</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${AMBER};border-radius:4px;">
                      <a href="${editionsUrl}" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;">Browse editions →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "The Desk · Intelligence",
    "",
    "You're already on the list.",
    "",
    "This address is already confirmed and receiving The Desk. Your email",
    "client may have automatically clicked the original confirmation link —",
    "that's a safety feature some providers use, not an error on your end.",
    "",
    `Browse editions: ${editionsUrl}`,
    "",
    "The Desk · Daily intelligence for property partnerships",
    "Curated by Ruben Laubscher.",
  ].join("\n");

  return send({ to, subject: "You're already on the list · The Desk", html, text });
}

/** Notifies a single confirmed subscriber that a new weekly edition is live. */
export async function sendEditionNotificationEmail({
  to,
  name,
  editionNumber,
  weekRange,
  editionUrl,
  unsubscribeUrl,
}: {
  to: string;
  name: string | null;
  editionNumber: number;
  weekRange: string;
  editionUrl: string;
  unsubscribeUrl: string;
}): Promise<SendResult> {
  const greeting: string | null = name ? (name.split(" ")[0] ?? null) : null;
  const html = editionNotificationHtml({ greeting, editionNumber, weekRange, editionUrl, unsubscribeUrl });
  const text = [
    "The Desk · Intelligence",
    "",
    `Edition #${editionNumber} — ${weekRange}`,
    "",
    greeting ? `Hi ${greeting},` : "Hi,",
    "",
    "Your weekly intelligence briefing is ready.",
    "",
    `Read it here: ${editionUrl}`,
    "",
    "—",
    "The Desk · Daily intelligence for property partnerships",
    "Curated by Ruben Laubscher.",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return send({
    to,
    subject: `Edition #${editionNumber} — ${weekRange} · The Desk`,
    html,
    text,
  });
}

/** Sends the daily brief — top-5 stories with why-it-matters context —
 *  to a single confirmed subscriber. Called after LLM enrichment so the
 *  email has the AI-generated context lines, not raw summaries. */
export async function sendDailyBriefEmail({
  to,
  name,
  items,
  feedDate,
  siteUrl,
  unsubscribeUrl,
}: {
  to: string;
  name?: string | null;
  items: Array<{
    id: number;
    title: string;
    category: string;
    whyItMatters?: string | null;
    summary: string;
  }>;
  feedDate: string;
  siteUrl: string;
  unsubscribeUrl: string;
}): Promise<SendResult> {
  const greeting = name ? (name.split(" ")[0] ?? null) : null;
  const displayDate = new Date(`${feedDate}T12:00:00Z`).toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const html = dailyBriefHtml({ greeting, items, displayDate, briefUrl: siteUrl, unsubscribeUrl });
  const storyLines = items.map((it, i) =>
    `${i + 1}. ${it.title}\n   ${it.whyItMatters ?? it.summary}`
  );
  const text = [
    "The Desk · Intelligence",
    "",
    `Today's brief · ${displayDate}`,
    greeting ? `\nHi ${greeting},` : "",
    "",
    ...storyLines,
    "",
    `Read the full brief: ${siteUrl}`,
    "",
    "—",
    "The Desk · Daily intelligence for property partnerships",
    "Curated by Ruben Laubscher.",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return send({
    to,
    subject: `The Desk · ${displayDate} — ${items.length} stor${items.length === 1 ? "y" : "ies"}`,
    html,
    text,
  });
}

/** HMAC-signed URL for the one-tap nudge response. */
export function nudgeResponseUrl(queueItemId: number, result: "yes" | "not-yet", siteOrigin: string): string {
  const sig = createHmac("sha256", process.env.JWT_SECRET ?? "dev")
    .update(`nudge:${queueItemId}`)
    .digest("base64url");
  return `${siteOrigin}/api/nudge/respond?id=${queueItemId}&sig=${encodeURIComponent(sig)}&result=${result}`;
}

/** Weekly recap email sent to all subscribers on Sunday evening. Summarises
 *  what The Desk published that week and surfaces the top talking points. */
export async function sendWeeklyRecapEmail({
  to,
  name,
  weekRange,
  storyCount,
  talkingPoints,
  thisWeekUrl,
  unsubscribeUrl,
}: {
  to: string;
  name?: string | null;
  weekRange: string;
  storyCount: number;
  talkingPoints: Array<{ title: string; category: string; sayThis: string }>;
  thisWeekUrl: string;
  unsubscribeUrl: string;
}): Promise<SendResult> {
  const greeting = name ? (name.split(" ")[0] ?? null) : null;
  const html = weeklyRecapHtml({ greeting, weekRange, storyCount, talkingPoints, thisWeekUrl, unsubscribeUrl });
  const tpLines = talkingPoints.map((tp, i) =>
    `${i + 1}. [${tp.category}] ${tp.title}\n   "${tp.sayThis}"`
  );
  const text = [
    "The Desk · Intelligence",
    "",
    `Your week · ${weekRange}`,
    greeting ? `\nHi ${greeting},` : "",
    "",
    `${storyCount} stories published this week · ${talkingPoints.length} talking points`,
    "",
    ...tpLines,
    "",
    `Review this week's talking points: ${thisWeekUrl}`,
    "",
    "—",
    "The Desk · Daily intelligence for property partnerships",
    "Curated by Ruben Laubscher.",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return send({
    to,
    subject: `Your week on The Desk · ${weekRange}`,
    html,
    text,
  });
}

/** Nudge email sent 2-3 days after saving a talking point to the reading
 *  queue. Asks the user whether the client angle landed. */
export async function sendTalkingPointNudgeEmail({
  to,
  storyTitle,
  category,
  sayThis,
  yesUrl,
  notYetUrl,
}: {
  to: string;
  storyTitle: string;
  category: string;
  sayThis: string;
  yesUrl: string;
  notYetUrl: string;
}): Promise<SendResult> {
  const html = talkingPointNudgeHtml({ storyTitle, category, sayThis, yesUrl, notYetUrl });
  const text = [
    "The Desk · Intelligence",
    "",
    `Did the ${category} angle land?`,
    "",
    `You saved this to your queue a few days ago:`,
    `"${storyTitle}"`,
    "",
    `Say this: "${sayThis}"`,
    "",
    `Tap to let us know:`,
    `Yes, it landed! → ${yesUrl}`,
    `Not yet → ${notYetUrl}`,
    "",
    "—",
    "The Desk · Daily intelligence for property partnerships",
  ].join("\n");
  return send({
    to,
    subject: `Did the ${category} angle land? · The Desk`,
    html,
    text,
  });
}

/** Tiny HTML template. Inline styles only so it renders in every
 *  email client without bouncing off stripped <link>/<style> tags. */
function confirmEmailHtml({ confirmUrl }: { confirmUrl: string }): string {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";

  return `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Confirm your subscription</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      /* Gmail dark-mode override: Gmail wraps email body in <u> */
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;background-color:${NAVY};">
            <!-- Masthead -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Editorial rule -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">One more step</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:36px;line-height:1.05;color:${FG};margin:0 0 16px;letter-spacing:-0.02em;">Confirm your subscription.</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 24px;">Tap the button below to lock it in. The link expires in 24 hours. If you didn't ask for this, ignore the message and nothing happens.</p>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${AMBER};border-radius:4px;">
                      <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;">Confirm subscription</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer rule -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>

            <!-- Footer copy -->
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function dailyBriefHtml({
  greeting,
  items,
  displayDate,
  briefUrl,
  unsubscribeUrl,
}: {
  greeting: string | null;
  items: Array<{ id: number; title: string; category: string; whyItMatters?: string | null; summary: string }>;
  displayDate: string;
  briefUrl: string;
  unsubscribeUrl: string;
}): string {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";
  const BORDER = "rgba(212,168,83,0.18)";

  const storyRows = items
    .map((item) => {
      const context = (item.whyItMatters || item.summary || "").slice(0, 220);
      return `
            <tr>
              <td bgcolor="${NAVY}" style="padding:18px 0;border-top:1px solid ${BORDER};background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.2em;color:${AMBER};text-transform:uppercase;margin-bottom:8px;">${item.category}</div>
                <h3 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;line-height:1.25;color:${FG};margin:0 0 8px;letter-spacing:-0.01em;">
                  <a href="${briefUrl}/story/${item.id}" style="color:${FG};text-decoration:none;">${item.title}</a>
                </h3>
                ${context ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.55;color:${FG_MUTED};margin:0;">${context}</p>` : ""}
              </td>
            </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Today's brief · ${displayDate}</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;background-color:${NAVY};">
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 8px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">Today's brief · ${displayDate}</div>
                ${greeting ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 8px;">Hi ${greeting},</p>` : ""}
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:${FG_MUTED};margin:0;">${items.length} stor${items.length === 1 ? "y" : "ies"} worth knowing before your next conversation.</p>
              </td>
            </tr>
            ${storyRows}
            <tr>
              <td bgcolor="${NAVY}" style="padding:28px 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${AMBER};border-radius:4px;">
                      <a href="${briefUrl}" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;">Read the full brief →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0 0 8px;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="${unsubscribeUrl}" style="color:${FG_SUBTLE};text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function editionNotificationHtml({
  greeting,
  editionNumber,
  weekRange,
  editionUrl,
  unsubscribeUrl,
}: {
  greeting: string | null;
  editionNumber: number;
  weekRange: string;
  editionUrl: string;
  unsubscribeUrl: string;
}): string {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";

  return `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Edition #${editionNumber} — ${weekRange}</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      /* Gmail dark-mode override: Gmail wraps email body in <u> */
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;background-color:${NAVY};">
            <!-- Masthead -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Editorial rule -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">Weekly Edition · ${weekRange}</div>
                ${greeting ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 16px;">Hi ${greeting},</p>` : ""}
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:36px;line-height:1.05;color:${FG};margin:0 0 16px;letter-spacing:-0.02em;">Edition #${editionNumber} is ready.</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 24px;">Your weekly intelligence briefing — market signals, talking points, and the context you need before any client conversation this week.</p>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${AMBER};border-radius:4px;">
                      <a href="${editionUrl}" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;">Read Edition #${editionNumber} →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer rule -->
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>

            <!-- Footer copy -->
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0 0 8px;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="${unsubscribeUrl}" style="color:${FG_SUBTLE};text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function weeklyRecapHtml({
  greeting,
  weekRange,
  storyCount,
  talkingPoints,
  thisWeekUrl,
  unsubscribeUrl,
}: {
  greeting: string | null;
  weekRange: string;
  storyCount: number;
  talkingPoints: Array<{ title: string; category: string; sayThis: string }>;
  thisWeekUrl: string;
  unsubscribeUrl: string;
}): string {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";
  const BORDER = "rgba(212,168,83,0.18)";

  const tpRows = talkingPoints.slice(0, 3)
    .map((tp) => `
            <tr>
              <td bgcolor="${NAVY}" style="padding:18px 0;border-top:1px solid ${BORDER};background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.2em;color:${AMBER};text-transform:uppercase;margin-bottom:8px;">${tp.category}</div>
                <p style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:16px;line-height:1.3;color:${FG};margin:0 0 10px;">${tp.title}</p>
                <div style="background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.25);border-radius:4px;padding:12px 14px;">
                  <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:9px;letter-spacing:0.2em;color:${AMBER};text-transform:uppercase;margin-bottom:6px;">Say this</div>
                  <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.5;color:${FG};margin:0;">"${tp.sayThis}"</p>
                </div>
              </td>
            </tr>`)
    .join("");

  const tpSummary = talkingPoints.length === 1
    ? "1 talking point"
    : `${talkingPoints.length} talking points`;

  return `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Your week on The Desk · ${weekRange}</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;background-color:${NAVY};">
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 8px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">Your week · ${weekRange}</div>
                ${greeting ? `<p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 8px;">Hi ${greeting},</p>` : ""}
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:30px;line-height:1.1;color:${FG};margin:0 0 12px;letter-spacing:-0.02em;">The Desk delivered ${storyCount} stor${storyCount === 1 ? "y" : "ies"} this week.</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:${FG_MUTED};margin:0;">${tpSummary} worth using with clients — ready when you are.</p>
              </td>
            </tr>
            ${tpRows}
            <tr>
              <td bgcolor="${NAVY}" style="padding:28px 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${AMBER};border-radius:4px;">
                      <a href="${thisWeekUrl}" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;">Review this week's talking points →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0 0 8px;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="${unsubscribeUrl}" style="color:${FG_SUBTLE};text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function talkingPointNudgeHtml({
  storyTitle,
  category,
  sayThis,
  yesUrl,
  notYetUrl,
}: {
  storyTitle: string;
  category: string;
  sayThis: string;
  yesUrl: string;
  notYetUrl: string;
}): string {
  const NAVY = "#0C1220";
  const AMBER = "#D4A853";
  const AMBER_BRIGHT = "#F0C75E";
  const FG = "#F0EDE8";
  const FG_MUTED = "#9BA3B5";
  const FG_SUBTLE = "#6B7280";
  const GREEN = "#4ade80";
  const GREEN_BG = "rgba(74,222,128,0.08)";
  const GREEN_BORDER = "rgba(74,222,128,0.3)";

  return `<!doctype html>
<html lang="en" style="background-color:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Did the ${category} angle land?</title>
    <style>
      :root { color-scheme: dark; }
      body, .email-body { background-color: ${NAVY} !important; color: ${FG} !important; }
      .email-wrap { background-color: ${NAVY} !important; }
      u + .email-body { background-color: ${NAVY} !important; }
      u + .email-body .email-wrap { background-color: ${NAVY} !important; }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" class="email-wrap" style="background-color:${NAVY};">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="padding:48px 16px;background-color:${NAVY};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:480px;background-color:${NAVY};">
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;padding-right:12px;background-color:${NAVY};">
                      <svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
                        <g fill="none" stroke="${AMBER}" stroke-linecap="round" stroke-linejoin="round">
                          <g stroke-width="7">
                            <line x1="56" y1="16" x2="56" y2="264"/>
                            <line x1="56" y1="100" x2="92" y2="100"/>
                            <line x1="56" y1="264" x2="92" y2="264"/>
                            <path d="M 92 100 A 82 82 0 0 1 92 264"/>
                          </g>
                          <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="${AMBER}" stroke="none"/>
                          <g stroke-width="3">
                            <line x1="104.3" y1="173" x2="58" y2="173"/>
                            <line x1="104.3" y1="173" x2="61.6" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="79.7" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="104.3" y2="123.7"/>
                            <line x1="104.3" y1="173" x2="128.9" y2="130.3"/>
                            <line x1="104.3" y1="173" x2="147" y2="148.3"/>
                            <line x1="104.3" y1="173" x2="153.6" y2="173"/>
                          </g>
                        </g>
                      </svg>
                    </td>
                    <td bgcolor="${NAVY}" style="vertical-align:middle;background-color:${NAVY};">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 24px;background-color:${NAVY};">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">Quick check-in · ${category}</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:28px;line-height:1.1;color:${FG};margin:0 0 12px;letter-spacing:-0.02em;">Did the angle land?</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${FG_MUTED};margin:0 0 20px;">A few days ago you saved this talking point to your queue:</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${FG};font-weight:700;margin:0 0 16px;">${storyTitle}</p>
                <div style="background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.25);border-radius:4px;padding:14px 16px;margin:0 0 28px;">
                  <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:9px;letter-spacing:0.2em;color:${AMBER};text-transform:uppercase;margin-bottom:8px;">Say this</div>
                  <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:${FG};margin:0;">"${sayThis}"</p>
                </div>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:${FG_MUTED};margin:0 0 20px;">Did you use it with a client? One tap — helps track what's working.</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:0 0 32px;background-color:${NAVY};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td bgcolor="${NAVY}" style="width:48%;padding-right:8px;background-color:${NAVY};">
                      <a href="${yesUrl}" style="display:block;text-align:center;padding:14px 16px;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${NAVY};text-decoration:none;font-weight:600;background:${GREEN};border-radius:4px;">Yes, it landed ✓</a>
                    </td>
                    <td bgcolor="${NAVY}" style="width:48%;padding-left:8px;background-color:${NAVY};">
                      <a href="${notYetUrl}" style="display:block;text-align:center;padding:14px 16px;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${FG};text-decoration:none;font-weight:600;background:${GREEN_BG};border:1px solid ${GREEN_BORDER};border-radius:4px;">Not yet</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="padding:8px 0 16px;background-color:${NAVY};">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${NAVY}" style="background-color:${NAVY};">
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0 0 10px;">Curated by Ruben Laubscher. Australian English throughout.</p>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${FG_SUBTLE};margin:0;">
                  <a href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${FG_SUBTLE};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a href="https://www.instagram.com/thedesk.au/" style="color:${FG_SUBTLE};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a href="https://rubenlaubscher.substack.com/" style="color:${FG_SUBTLE};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${AMBER};text-decoration:none;">Subscribe to The Desk →</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
