# Brand

Canonical brand guide: [`brand-identity.pdf`](./brand-identity.pdf) (Version 2.0).
If a rule in the guide conflicts with code, **code wins** — fix the doc.

## Where the brand lives in the codebase

| Concern | Source of truth |
| --- | --- |
| Colour, type, motion, gradient, spacing tokens | `client/src/index.css` (`@theme` block + `.light` overrides) |
| Brand fonts | `client/public/fonts/*.woff2`, declared via `@font-face` in `client/src/index.css` |
| Logomark / lockup / byline | `client/src/components/Logomark.tsx` |
| Logo + export assets (SVG/PNG) | `client/public/brand/` |
| Favicon, OG card, app icons | `client/public/` |
| Voice and tone | `server/prompts/voice.ts` |

## Typography

The three brand faces — Source Sans 3 (body), Playfair Display (display/headlines),
JetBrains Mono (overlines, labels, CTAs, tabular numbers) — are **self-hosted** as
variable woff2 rather than loaded from the Google Fonts CDN. This keeps the exact
files shipped in the brand pack, works offline in the PWA, and avoids leaking
visitor IPs to a third party on first paint, consistent with the product's
self-hosted analytics and the "no tracking pixels" principle (guide §11).

Do not reintroduce a CDN `<link>` for fonts or substitute a different face — the
pairing is non-negotiable (guide §4).

## Rules of thumb

- Never invent a colour. Add it to the `@theme` block in `index.css` and use the token.
- Never write `linear-gradient()` inline. Reference a `--grad-*` token.
- Never recolour the wordmark or change the `INTELLIGENCE` byline.
- Australian English throughout (colour, behaviour, organisation, realise).
