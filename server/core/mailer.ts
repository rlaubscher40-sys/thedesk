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
 *
 * Navy-first design: the inline styles bake in the dark navy palette as
 * the hard default so every client renders the same brand surface —
 * Gmail (which ignores prefers-color-scheme colour swaps and runs its
 * own dark-mode pass), Outlook, and Apple Mail alike. The
 * @media (prefers-color-scheme: dark) + [data-ogsc] block is kept only
 * to pin those same navy values for clients that try to auto-invert a
 * dark email back toward light.
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

// ─── Shared design tokens ────────────────────────────────────────────────────

// Navy palette baked in as the inline default so every client (Gmail
// included) renders the same dark brand surface.
const L = {
  outerBg:  "#0C1220",
  bg:       "#0C1220",
  heading:  "#F0C75E",   // gold wordmark + headlines on navy
  amber:    "#D4A853",   // section labels / eyebrows
  amberBtn: "#D4A853",   // CTA button background (navy text on top)
  btnText:  "#0C1220",   // navy text on the gold CTA button
  text:     "#F0EDE8",   // cream body copy
  muted:    "#9BA3B5",   // slate secondary copy
  subtle:   "#6B7280",   // footer / fine print
  border:   "rgba(212,168,83,0.25)",
};

// Re-pins the navy palette for clients that try to auto-invert a dark
// email back toward light. Mirrors the inline defaults above.
// Classes: em-bg, em-ob, em-h, em-t, em-m, em-s, em-a, em-btn-t
const DARK_CSS = `
  @media (prefers-color-scheme:dark){
    .em-ob{background-color:#0C1220!important}
    .em-bg{background-color:#0C1220!important}
    .em-h{color:#F0C75E!important}
    .em-t{color:#F0EDE8!important}
    .em-m{color:#9BA3B5!important}
    .em-s{color:#6B7280!important}
    .em-a{color:#D4A853!important}
    .em-btn-t{color:#0C1220!important}
    .em-rule-full{background:linear-gradient(90deg,#D4A853 0%,rgba(212,168,83,0) 80%)!important}
    .em-rule-sub{background:rgba(212,168,83,0.4)!important}
    .em-story-border{border-top-color:rgba(212,168,83,0.18)!important}
    .em-pill{background:rgba(212,168,83,0.08)!important;border-color:rgba(212,168,83,0.25)!important}
    .em-pill-t{color:#F0EDE8!important}
  }
  [data-ogsc] .em-ob{background-color:#0C1220!important}
  [data-ogsc] .em-bg{background-color:#0C1220!important}
  [data-ogsc] .em-h{color:#F0C75E!important}
  [data-ogsc] .em-t{color:#F0EDE8!important}
  [data-ogsc] .em-m{color:#9BA3B5!important}
  [data-ogsc] .em-s{color:#6B7280!important}
  [data-ogsc] .em-a{color:#D4A853!important}
  [data-ogsc] .em-btn-t{color:#0C1220!important}
  u+.em-body .em-ob{background-color:#0C1220!important}
  u+.em-body .em-bg{background-color:#0C1220!important}
  u+.em-body .em-h{color:#F0C75E!important}
  u+.em-body .em-t{color:#F0EDE8!important}
  u+.em-body .em-m{color:#9BA3B5!important}
  u+.em-body .em-s{color:#6B7280!important}
  u+.em-body .em-a{color:#D4A853!important}
  u+.em-body .em-btn-t{color:#0C1220!important}
`.trim();

function emailHead(title: string): string {
  return `<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="color-scheme" content="light dark"/>
    <meta name="supported-color-schemes" content="light dark"/>
    <title>${title}</title>
    <style>${DARK_CSS}</style>
  </head>`;
}

const LOGO_SVG = `<svg width="36" height="42" viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#D4A853" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="7">
      <line x1="56" y1="16" x2="56" y2="264"/>
      <line x1="56" y1="100" x2="92" y2="100"/>
      <line x1="56" y1="264" x2="92" y2="264"/>
      <path d="M 92 100 A 82 82 0 0 1 92 264"/>
    </g>
    <path d="M 68.3 177 A 36 36 0 0 1 140.3 177 Z" fill="#D4A853" stroke="none"/>
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
</svg>`;

function mastheadRow(): string {
  return `<tr>
    <td class="em-bg" bgcolor="${L.bg}" style="padding:32px 0 24px;background-color:${L.bg};">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;padding-right:12px;">${LOGO_SVG}</td>
          <td style="vertical-align:middle;">
            <div class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${L.heading};">The Desk</div>
            <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-top:6px;">Intelligence</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function ruleFullRow(): string {
  return `<tr>
    <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 28px;background-color:${L.bg};">
      <div class="em-rule-full" style="height:1px;background:linear-gradient(90deg,${L.amberBtn} 0%,rgba(212,168,83,0) 80%);"></div>
    </td>
  </tr>`;
}

function ruleSubRow(): string {
  return `<tr>
    <td class="em-bg" bgcolor="${L.bg}" style="padding:8px 0 16px;background-color:${L.bg};">
      <div class="em-rule-sub" style="height:1px;background:${L.border};"></div>
    </td>
  </tr>`;
}

function ctaRow(href: string, label: string): string {
  return `<tr>
    <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 32px;background-color:${L.bg};">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:${L.amberBtn};border-radius:4px;">
            <a href="${href}" class="em-btn-t" style="display:inline-block;padding:14px 28px;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${L.btnText};text-decoration:none;font-weight:600;">${label}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function footerRow(unsubscribeUrl?: string): string {
  const unsub = unsubscribeUrl
    ? `<p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;color:${L.subtle};margin:8px 0 0;"><a class="em-s" href="${unsubscribeUrl}" style="color:${L.subtle};text-decoration:underline;">Unsubscribe</a></p>`
    : "";
  return `${ruleSubRow()}
  <tr>
    <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 32px;background-color:${L.bg};">
      <p class="em-s" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${L.subtle};text-transform:uppercase;margin:0 0 6px;">The Desk · Daily intelligence for property partnerships</p>
      <p class="em-s" style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${L.subtle};margin:0 0 8px;">Curated by Ruben Laubscher. Australian English throughout.</p>
      <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.12em;margin:0;">
        <a class="em-s" href="https://www.linkedin.com/in/ruben-laubscher/" style="color:${L.subtle};text-decoration:none;">LinkedIn</a>&nbsp;·&nbsp;<a class="em-s" href="https://www.instagram.com/thedesk.au/" style="color:${L.subtle};text-decoration:none;">Instagram</a>&nbsp;·&nbsp;<a class="em-s" href="https://rubenlaubscher.substack.com/" style="color:${L.subtle};text-decoration:none;">Substack</a>&nbsp;·&nbsp;<a href="https://thedesk.au/" style="color:${L.amberBtn};text-decoration:none;">Subscribe to The Desk →</a>
      </p>
      ${unsub}
    </td>
  </tr>`;
}

function wrapLayout(title: string, innerRows: string): string {
  return `<!doctype html>
<html lang="en">
${emailHead(title)}
<body class="em-body em-ob" style="margin:0;padding:0;background-color:${L.outerBg};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-ob" bgcolor="${L.outerBg}" style="background-color:${L.outerBg};">
    <tr>
      <td align="center" class="em-ob" bgcolor="${L.outerBg}" style="padding:32px 16px;background-color:${L.outerBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-bg" bgcolor="${L.bg}" style="max-width:560px;background-color:${L.bg};border-radius:6px;overflow:hidden;">
          <tr><td style="padding:0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${innerRows}
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Public send helpers ─────────────────────────────────────────────────────

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

/** Sent when someone re-subscribes with an already-confirmed address. */
export async function sendAlreadyConfirmedEmail({
  to,
  editionsUrl,
}: {
  to: string;
  editionsUrl: string;
}): Promise<SendResult> {
  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 24px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:12px;">Already confirmed</div>
        <h1 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:30px;line-height:1.05;color:${L.heading};margin:0 0 14px;letter-spacing:-0.02em;">You're already on the list.</h1>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${L.muted};margin:0 0 24px;">This address is already confirmed and receiving The Desk. Your email client may have automatically clicked the original confirmation link — that's a safety feature some providers use, not an error on your end. You won't miss a thing.</p>
      </td>
    </tr>
    ${ctaRow(editionsUrl, "Browse editions →")}
    ${footerRow()}
  `;
  const html = wrapLayout("You're already on the list", inner);
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

/** Weekly recap email sent to all subscribers on Sunday evening. */
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

/** Nudge email sent 2-3 days after saving a talking point to the reading queue. */
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

// ─── HTML templates ──────────────────────────────────────────────────────────

function confirmEmailHtml({ confirmUrl }: { confirmUrl: string }): string {
  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 24px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:12px;">One more step</div>
        <h1 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:34px;line-height:1.05;color:${L.heading};margin:0 0 14px;letter-spacing:-0.02em;">Confirm your subscription.</h1>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${L.muted};margin:0 0 24px;">Tap the button below to lock it in. The link expires in 24 hours. If you didn't ask for this, ignore the message and nothing happens.</p>
      </td>
    </tr>
    ${ctaRow(confirmUrl, "Confirm subscription")}
    ${footerRow()}
  `;
  return wrapLayout("Confirm your subscription", inner);
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
  const storyRows = items
    .map((item) => {
      const context = (item.whyItMatters || item.summary || "").slice(0, 220);
      return `<tr>
        <td class="em-bg em-story-border" bgcolor="${L.bg}" style="padding:18px 0;border-top:1px solid ${L.border};background-color:${L.bg};">
          <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.2em;color:${L.amber};text-transform:uppercase;margin-bottom:8px;">${item.category}</div>
          <h3 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;line-height:1.25;color:${L.heading};margin:0 0 8px;letter-spacing:-0.01em;">
            <a class="em-h" href="${briefUrl}/story/${item.id}" style="color:${L.heading};text-decoration:none;">${item.title}</a>
          </h3>
          ${context ? `<p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:${L.muted};margin:0;">${context}</p>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 8px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:10px;">Today's brief · ${displayDate}</div>
        ${greeting ? `<p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:${L.muted};margin:0 0 6px;">Hi ${greeting},</p>` : ""}
        <p class="em-t" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:${L.text};margin:0;">${items.length} stor${items.length === 1 ? "y" : "ies"} worth knowing before your next conversation.</p>
      </td>
    </tr>
    ${storyRows}
    <tr><td class="em-bg" bgcolor="${L.bg}" style="padding:12px 0 0;background-color:${L.bg};"></td></tr>
    ${ctaRow(briefUrl, "Read the full brief →")}
    ${footerRow(unsubscribeUrl)}
  `;
  return wrapLayout(`Today's brief · ${displayDate}`, inner);
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
  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 24px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:12px;">Weekly Edition · ${weekRange}</div>
        ${greeting ? `<p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:${L.muted};margin:0 0 14px;">Hi ${greeting},</p>` : ""}
        <h1 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:34px;line-height:1.05;color:${L.heading};margin:0 0 14px;letter-spacing:-0.02em;">Edition #${editionNumber} is ready.</h1>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${L.muted};margin:0 0 24px;">Your weekly intelligence briefing — market signals, talking points, and the context you need before any client conversation this week.</p>
      </td>
    </tr>
    ${ctaRow(editionUrl, `Read Edition #${editionNumber} →`)}
    ${footerRow(unsubscribeUrl)}
  `;
  return wrapLayout(`Edition #${editionNumber} — ${weekRange}`, inner);
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
  const tpSummary = talkingPoints.length === 1 ? "1 talking point" : `${talkingPoints.length} talking points`;

  const tpRows = talkingPoints.slice(0, 3)
    .map((tp) => `<tr>
      <td class="em-bg em-story-border" bgcolor="${L.bg}" style="padding:18px 0;border-top:1px solid ${L.border};background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.2em;color:${L.amber};text-transform:uppercase;margin-bottom:8px;">${tp.category}</div>
        <p class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:16px;line-height:1.3;color:${L.heading};margin:0 0 10px;">${tp.title}</p>
        <div class="em-pill" style="background:rgba(212,168,83,0.08);border:1px solid ${L.border};border-radius:4px;padding:12px 14px;">
          <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:9px;letter-spacing:0.2em;color:${L.amber};text-transform:uppercase;margin-bottom:6px;">Say this</div>
          <p class="em-t em-pill-t" style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.5;color:${L.text};margin:0;">"${tp.sayThis}"</p>
        </div>
      </td>
    </tr>`)
    .join("");

  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 8px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:10px;">Your week · ${weekRange}</div>
        ${greeting ? `<p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:${L.muted};margin:0 0 8px;">Hi ${greeting},</p>` : ""}
        <h1 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:28px;line-height:1.1;color:${L.heading};margin:0 0 10px;letter-spacing:-0.02em;">The Desk delivered ${storyCount} stor${storyCount === 1 ? "y" : "ies"} this week.</h1>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:${L.muted};margin:0;">${tpSummary} worth using with clients — ready when you are.</p>
      </td>
    </tr>
    ${tpRows}
    <tr><td class="em-bg" bgcolor="${L.bg}" style="padding:12px 0 0;background-color:${L.bg};"></td></tr>
    ${ctaRow(thisWeekUrl, "Review this week's talking points →")}
    ${footerRow(unsubscribeUrl)}
  `;
  return wrapLayout(`Your week on The Desk · ${weekRange}`, inner);
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
  const inner = `
    ${mastheadRow()}
    ${ruleFullRow()}
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 24px;background-color:${L.bg};">
        <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${L.amber};text-transform:uppercase;margin-bottom:12px;">Quick check-in · ${category}</div>
        <h1 class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:28px;line-height:1.1;color:${L.heading};margin:0 0 12px;letter-spacing:-0.02em;">Did the angle land?</h1>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:${L.muted};margin:0 0 16px;">A few days ago you saved this talking point to your queue:</p>
        <p class="em-h" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${L.heading};font-weight:700;margin:0 0 14px;">${storyTitle}</p>
        <div class="em-pill" style="background:rgba(212,168,83,0.08);border:1px solid ${L.border};border-radius:4px;padding:14px 16px;margin:0 0 20px;">
          <div class="em-a" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:9px;letter-spacing:0.2em;color:${L.amber};text-transform:uppercase;margin-bottom:8px;">Say this</div>
          <p class="em-t em-pill-t" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:${L.text};margin:0;">"${sayThis}"</p>
        </div>
        <p class="em-m" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:${L.muted};margin:0 0 24px;">Did you use it with a client? One tap — helps track what's working.</p>
      </td>
    </tr>
    <tr>
      <td class="em-bg" bgcolor="${L.bg}" style="padding:0 0 32px;background-color:${L.bg};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:48%;padding-right:8px;">
              <a href="${yesUrl}" style="display:block;text-align:center;padding:14px 16px;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;font-weight:600;background:#16A34A;border-radius:4px;">Yes, it landed ✓</a>
            </td>
            <td style="width:48%;padding-left:8px;">
              <a href="${notYetUrl}" style="display:block;text-align:center;padding:14px 16px;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${L.muted};text-decoration:none;font-weight:600;background:transparent;border:1px solid ${L.border};border-radius:4px;">Not yet</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${footerRow()}
  `;
  return wrapLayout(`Did the ${category} angle land?`, inner);
}
