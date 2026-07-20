# Code audit — 20 Jul 2026

Full-repo audit of The Desk at `31b4b78` (main). Scope: server (Express 5 + tRPC + Drizzle/TiDB),
client (React 19), shared, ingest scripts. Method: manual review of every security-sensitive
surface plus correctness spot-checks, verified against `pnpm check` and `pnpm test`.

**Repo health: good.** `tsc --noEmit` is clean and all 211 tests across 28 files pass.
The codebase is unusually well-commented, input validation via Zod is consistent, raw SQL is
parameterised throughout (the only `sql.raw` is the static catch-up migration list), admin
mutations are properly gated behind `adminProcedure`, the session cookie is httpOnly +
SameSite=Lax, HMAC comparisons are constant-time, and public write endpoints carry per-IP rate
limits. The findings below are ranked; nothing here is an emergency, but the High items are
worth fixing promptly because they sit on unauthenticated surfaces.

---

## High

### H1. Public `subscribers.subscribe` returns the confirm token — double opt-in can be bypassed
`server/routers/subscribers.ts:98-103`

The public mutation returns `confirmToken` to the caller "so dev / demo can construct the
confirm URL by hand" — but it does so in production too. Anyone can subscribe a victim's
email **and immediately confirm it themselves** via `subscribers.confirm`, without ever
seeing the victim's inbox. The victim then receives daily briefs, weekly recaps and edition
notifications they never asked for, and the sender-reputation damage lands on your Resend
account. Fix: return the token only when `isDemoMode()` (or `NODE_ENV !== "production"`),
`null` otherwise.

### H2. Unauthenticated unsubscribe-by-email
`server/routers/subscribers.ts:119-124`

The signed `/api/unsubscribe` route carefully HMACs `email:exp` so a leaked old email can't
be replayed — but the public tRPC `subscribers.unsubscribe` mutation takes a bare email
address with no proof of ownership. Anyone who knows (or guesses) a subscriber's address can
silently remove them from the list. Fix: require the same HMAC token, or drop the tRPC route
and let the signed link be the only unsubscribe path. (Check what the client actually calls
first — if only the Settings page uses it, gate it behind the session instead.)

### H3. Unescaped HTML interpolation in subscriber emails
`server/core/mailer.ts` — `dailyBriefHtml`, `weeklyRecapHtml`, `editionNotificationHtml`,
`talkingPointNudgeHtml`

`greeting` (subscriber-supplied name from the public subscribe form), feed `title`,
`whyItMatters`, `sayThis` and topic titles are interpolated into email HTML with no escaping.
Feed titles originate from **external RSS sources**, so a compromised or malicious outlet
headline containing markup would render as live HTML in every subscriber's daily brief
(tracking pixels, phishing links styled as your CTA, layout break-out).
`sendAdminAlertEmail` already strips `<>` from its detail string, so the risk was known —
the subscriber-facing templates just never got the same treatment. Fix: add an
`escapeHtml()` helper (same as `htmlEscape` in `server/core/seo.ts`) and apply it to every
dynamic value at interpolation time.

---

## Medium

### M1. JSON-LD injection in the SEO-rewritten edition page
`server/core/seo.ts:161`

`JSON.stringify(articleSchema)` is embedded in a `<script type="application/ld+json">` block.
`JSON.stringify` does not escape `<`, so a `</script>` sequence inside `metaTitle` /
`metaDescription` / `rubensTake` (LLM-generated, admin-editable) terminates the script block
and injects markup into the public page. Content is semi-trusted so likelihood is low, but
the fix is one line: `JSON.stringify(articleSchema).replace(/</g, "\\u003c")`.

### M2. Background `setImmediate` jobs can crash the process on a DB blip
`server/scheduledRoutes.ts` — weekly-edition (~line 422) and synthesize-edition (~line 627)
background blocks

Express 5 routes rejected handler promises to the error middleware, but the detached
`setImmediate(async () => …)` enrichment jobs are outside that safety net, and several awaits
sit outside any try/catch: `db.getEditionByNumber`, `db.updateHeroImage`,
`db.updateRubensTake`, `db.updateEditionSynthesis`, plus the final `updateHeroImage` /
`updateRubensTake` after the `Promise.allSettled`. There is no `process.on("unhandledRejection")`
handler anywhere, and Node 22's default is to **crash the process** on an unhandled
rejection — so a transient TiDB error during enrichment takes the whole site down.
(The daily-feed background block wraps everything, so it's fine.) Fix: wrap each
`setImmediate` body in one outer try/catch (logging to `server_errors`), and consider a
process-level `unhandledRejection` handler as a belt-and-braces backstop.

### M3. `createFeedItems` assumes batch-insert IDs are consecutive
`server/db/feed.ts:172-177`

The batch path derives every row's ID as `firstId + i` from the first `insertId`. On MySQL
with the default auto-inc lock mode that holds; on **TiDB** (the stated production target)
auto-increment values inside one multi-row INSERT are allocated from cached ranges and can
jump when a range is exhausted mid-statement. If that happens, the index-aligned IDs the
enrichment pass zips against point at the wrong rows — partner tags and say-this lines
written onto the wrong stories, silently. Worth verifying against your TiDB config
(`AUTO_ID_CACHE`); the safe fix is to re-select the inserted rows by `sourceUrl`/`title`
+ `feedDate`, or use the row-by-row path (already implemented as the fallback) for
correctness-critical ingestion.

### M4. Scheduled API key accepted via `?key=` query string
`server/scheduledRoutes.ts:57-58`

Query-string secrets leak into proxy/access logs, Railway request logs, and any error
tracker that captures URLs. The `x-scheduled-key` header path already exists and the
in-process scheduler uses it. Deprecate the query variant (the Instagram preview URL is the
one place it's convenient — an admin cookie also works there).

### M5. `GET /api/nudge/respond` mutates state on a GET
`server/scheduledRoutes.ts:1122-1147`

Email security scanners auto-fetch links — a behaviour this codebase explicitly documents in
the subscribe flow ("email security scanner auto-clicked their confirm link"). The nudge
email's "Yes, it landed" / "Not yet" links are GETs that immediately write the response, so
a scanner that prefetches both links records a bogus answer (whichever lands last wins).
Fix: make the GET render a page whose button POSTs the actual response, or at minimum
require a human-triggered second step.

### M6. Host-header-derived URLs in cacheable public XML
`server/core/seo.ts:21-27`

When `SITE_URL` is unset, `siteUrl()` trusts `x-forwarded-host` / `Host` to build sitemap,
RSS and canonical URLs — and those responses are served with `Cache-Control: public`. A
poisoned Host header could then be cached by an intermediary and served to real crawlers.
Fine as long as `SITE_URL` is always set in production; consider failing closed (fall back
to `DEFAULT_SITE_URL` instead of the header) so a missing env var can't open this up.

### M7. Weak dev fallback secret for HMAC links
`server/core/mailer.ts:288,437`, `server/scheduledRoutes.ts:1133`, `server/core/unsubscribeRoute.ts:71`

Unsubscribe and nudge signatures fall back to the literal `"dev"` when `JWT_SECRET` is
unset. Production boot refuses to start without `JWT_SECRET`, so this only bites a
non-production deploy that's publicly reachable — but there, every unsubscribe/nudge link is
forgeable. Also, three files reach for `process.env.JWT_SECRET` directly while the rest of
the codebase goes through `env.cookieSecret`; consolidate on the frozen env object and
refuse to sign with the fallback outside development.

---

## Low

- **L1. Subscriber-status oracle.** `subscribers.subscribe` returns `"already-confirmed"` vs
  `"pending-confirm"`, letting anyone test whether an address is on the list
  (`server/routers/subscribers.ts:71-75`). Return a uniform "check your inbox" response.
- **L2. Weekly notification fan-out is unpaced.** `notifySubscribers` fires all sends via
  `Promise.allSettled` while the daily brief paces 600 ms between sends and records
  per-subscriber delivery for retry; the weekly path does neither
  (`server/scheduledRoutes.ts:784-809`). At list sizes beyond Resend's ~2 req/s this will
  silently drop deliveries with no retry. Reuse the daily loop's pacing + `deliveredIds`
  pattern.
- **L3. Unescaped LIKE wildcards in public search.** `%`/`_` in the query string pass
  straight into `LIKE` patterns over `editions.fullText` (`server/db/editions.ts:268`,
  `server/db/feed.ts:385-399`). No injection risk (parameterised), but pathological patterns
  force full-text scans on an unindexed column on a public endpoint; the 90/min limiter is
  the only backstop. Escape wildcards and consider a length/complexity cap.
- **L4. `getTempImage` ignores `expiresAt` on read.** An expired Instagram temp image stays
  servable until the minute-sweeper runs (`server/instagram/tempStore.ts:36-42`). One-line
  check.
- **L5. CSP allows `'unsafe-inline'` scripts.** Documented as "no nonce pipeline yet"
  (`server/core/securityHeaders.ts:32`). With H3/M1 fixed this is defence-in-depth, but a
  nonce for the two inline scripts in `index.html` would let you drop it.
- **L6. `verifyPassword` leaks password length.** The early `length !== expected.length`
  return makes compare time length-dependent (`server/core/sdk.ts:38`). Marginal at this
  scale; hashing both sides (or HMAC-then-compare) removes it entirely.

---

## Documentation drift (worth a cleanup pass)

The README describes the previous incarnation of the app and now misleads in several places:

- Stack says **Express 4**; the app runs Express 5 (`package.json`), which matters for how
  async errors are handled (see M2).
- Env-var section lists **Manus OAuth** variables (`VITE_APP_ID`, `OAUTH_SERVER_URL`,
  `VITE_OAUTH_PORTAL_URL`, `BUILT_IN_FORGE_*`, `OWNER_OPEN_ID`) that no longer exist; the
  real required set is documented in `server/core/env.ts` (`ADMIN_PASSWORD`,
  `ANTHROPIC_API_KEY`, etc.).
- Project layout references routers/pages that were removed or renamed (`notes`,
  `conversations`, `readingQueue` list is stale) and omits the newer surfaces
  (subscribers, feedback, health, instagram, scheduler).
- README's Codespaces link points at `rubenlaubscher-beep/thedesk`, not this repo.

## What was checked and found sound

- **AuthZ:** every mutating tRPC procedure outside the intentional public set
  (feedback.submit, subscribers.\*, auth.logout) is `adminProcedure`/`protectedProcedure`;
  scheduled endpoints require the API key or an admin session; demo mode (everyone is
  admin) is unreachable in production because boot exits without `DATABASE_URL`.
- **Injection:** all Drizzle queries parameterised; `sql.raw` only for the static migration
  catch-up list; no `dangerouslySetInnerHTML` in the client (the crash-loop safe-mode screen
  writes static markup only).
- **CSRF:** SameSite=Lax httpOnly session cookie + JSON-body tRPC POSTs.
- **SSRF/resource abuse in ingest:** article/og fetches are bounded (timeouts, byte caps,
  redirect follow to public news URLs only by construction).
- **Rate limiting:** login (10/5 min, success-skipping), tRPC (90/min), analytics beacon,
  client-error sink, nudge + unsubscribe endpoints all carry per-IP buckets; `trust proxy`
  set for Railway.
- **Scheduler:** watermark + atomic claim design is solid; single-flight tick guard; capped
  attempts; terminal-failure alerting.
- **Secrets hygiene:** `.env.example` contains placeholders only; `/api/auth/status` exposes
  booleans, not values.
