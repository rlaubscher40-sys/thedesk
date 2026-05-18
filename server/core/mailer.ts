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
  const from = process.env.MAIL_FROM ?? "The Desk <hello@thedesk.global>";

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
    "Curated by Ruben Laubscher, Head of Partnerships at InvestorKit.",
  ].join("\n");
  return send({
    to,
    subject: "Confirm your subscription · The Desk",
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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm your subscription</title>
  </head>
  <body style="margin:0;padding:0;background:${NAVY};font-family:Georgia,'Times New Roman',serif;color:${FG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${NAVY};">
            <!-- Masthead -->
            <tr>
              <td style="padding:0 0 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
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
                    <td style="vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1;letter-spacing:-0.02em;color:${AMBER_BRIGHT};">The Desk</div>
                      <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;color:${FG_MUTED};text-transform:uppercase;margin-top:6px;">Intelligence</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Editorial rule -->
            <tr>
              <td style="padding:0 0 32px;">
                <div style="height:1px;background:linear-gradient(90deg, ${AMBER} 0%, rgba(212,168,83,0) 80%);"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:0 0 24px;">
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;color:${AMBER};text-transform:uppercase;margin-bottom:12px;">One more step</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:36px;line-height:1.05;color:${FG};margin:0 0 16px;letter-spacing:-0.02em;">Confirm your subscription.</h1>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${FG_MUTED};margin:0 0 24px;">Tap the button below to lock it in. The link expires in 24 hours. If you didn't ask for this, ignore the message and nothing happens.</p>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:0 0 32px;">
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
              <td style="padding:8px 0 16px;">
                <div style="height:1px;background:rgba(212,168,83,0.4);"></div>
              </td>
            </tr>

            <!-- Footer copy -->
            <tr>
              <td>
                <p style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.18em;color:${FG_SUBTLE};text-transform:uppercase;margin:0 0 8px;">The Desk · Daily intelligence for property partnerships</p>
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55;color:${FG_SUBTLE};margin:0;">Curated by Ruben Laubscher, Head of Partnerships at InvestorKit. Australian English throughout.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
