# Deploy guide

End-to-end setup for going from a local dev environment to a live, auto-updating
production site on Railway + TiDB Serverless. Time estimate: 60-90 minutes
including DNS propagation.

The site no longer depends on Manus services — LLM goes through the Anthropic
API directly, image generation is optional (OpenAI), and the only auth is a
single admin password you set.

---

## Required accounts

Sign up first:

| Service | Why | Cost |
|---|---|---|
| **TiDB Cloud** (tidbcloud.com) | MySQL-compatible database. Free Serverless tier covers this site forever. | $0 |
| **Railway** (railway.app) | Node hosting, GitHub integration, auto-deploy on push. | $5/mo after free credit |
| **Anthropic Console** (console.anthropic.com) | LLM enrichment (partnerTag, sayThis, weekly synthesis, Ruben's Take). | ~$5-15/mo depending on volume |
| **Resend** (resend.com) | Email delivery (optional, for the daily/weekly digest — not wired yet). | $0 to start, $20/mo at 5K emails |
| **Plausible** or **PostHog** | Analytics (optional but recommended). | $9/mo or free tier |
| **Sentry** (sentry.io) | Error monitoring (optional but recommended). | Free tier |
| **A registrar** (Namecheap, Cloudflare, etc.) | Custom domain. | $10-20/year |

Optional:

| Service | Why | Cost |
|---|---|---|
| **OpenAI** (platform.openai.com) | AI image generation for the weekly hero. Without it the site uses the gradient placeholder. | ~$0.20/mo |

---

## 1. Database — TiDB Serverless

1. **Create a cluster.** TiDB Cloud Console → Clusters → Create Cluster → Serverless. Region: pick AWS Sydney (`ap-southeast-2`) for low latency. Name: `the-desk`.
2. **Get the connection string.** Connect → "Drizzle" or "General" → copy the URL. It looks like `mysql://USER.root:PASS@gateway01.region.prod.aws.tidbcloud.com:4000/test?ssl={...}`.
3. **Rename the default database** to `thedesk` (or keep `test` — doesn't matter, just be consistent in `DATABASE_URL`).
4. **Test locally.** Set `DATABASE_URL=...` in `.env`, then run `pnpm db:push`. You should see all tables created (editions, daily_feed_items, subscribers, featured_linkedin_posts, etc.).

---

## 2. Anthropic API key

1. console.anthropic.com → Settings → API Keys → Create Key.
2. Save the key — you only see it once. Format: `sk-ant-api03-...`.
3. (Optional) Set a monthly spending limit on the Usage page — $20 is plenty to start.

---

## 3. Hosting — Railway

1. **New project** → Deploy from GitHub repo → select `rubenlaubscher-beep/thedesk`.
2. Railway auto-detects the Node app. **Set the start command** in Settings → Deploy if it isn't auto-detected:
   ```
   pnpm install --frozen-lockfile && pnpm build && pnpm start
   ```
   (Or just `pnpm install && pnpm start` if Railway picks up the build step.)
3. **Set env variables** (Settings → Variables):

   **Required:**
   ```
   DATABASE_URL          mysql://...                              (from TiDB)
   JWT_SECRET            <openssl rand -hex 32>
   ANTHROPIC_API_KEY     sk-ant-api03-...
   ADMIN_PASSWORD        <a strong password — only you need it>
   NODE_ENV              production
   PORT                  3000
   ```

   **Optional:**
   ```
   OPENAI_API_KEY        sk-...                        (hero image gen, and the Reel voice-over)
   SCHEDULED_API_KEY     <openssl rand -hex 32>                   (for GitHub Actions ingest)
   ```

   `OPENAI_API_KEY` is what makes Reels narrated. Without it a Reel still
   renders and still posts — silently, with no error anywhere — so the only
   way to notice is with the sound up. The boot log and the admin panel both
   say which it will be.

   Generate strong secrets:
   ```sh
   openssl rand -hex 32
   ```

4. **Deploy.** Railway builds + deploys on every push to your default branch.
5. **Run the database migration.** Either from your local machine (with `DATABASE_URL` pointing at production):
   ```sh
   pnpm db:push
   ```
   Or from Railway's Settings → Service → "Run command" with the same.

6. **Check the boot log for the Reel line.** Reels need an ffmpeg binary, and
   `ffmpeg-static` ships a downloader rather than the binary: it arrives in a
   postinstall script, which pnpm 10 only runs for packages listed in
   `pnpm.onlyBuiltDependencies`. It is listed, but that only helps if the
   install ran after that config landed. On boot the server prints either

   ```
   [reel] ffmpeg 7.0.2-static. Narration is on.
   ```

   or `[reel] NOT READY.` with the reason. If it is not ready, re-run the
   install; nothing else in the app is affected, but the Tuesday and Thursday
   Reel jobs will fail until it is. The same check is on the admin panel.

7. **Verify it's live.** Visit `https://<your-railway-domain>.up.railway.app` — the site loads with empty feed/edition lists until the first ingest populates them. (Demo seed data is dev-only: it never engages under `NODE_ENV=production`, and a production boot with `DATABASE_URL` unset now refuses to start rather than silently serving the demo UI.)

---

## 4. Custom domain

1. Railway → Settings → Networking → Custom Domain → add `thedesk.au` (or whatever you bought).
2. Railway gives you a CNAME target. Copy it.
3. At your registrar (or Cloudflare if you use it for DNS), add a CNAME:
   ```
   thedesk.au   CNAME   <railway-target>.up.railway.app
   www              CNAME   <railway-target>.up.railway.app
   ```
4. Wait 5-30 minutes for DNS to propagate. Railway auto-issues a Let's Encrypt cert.

---

## 5. GitHub Actions — daily + weekly ingest

The repo already ships `.github/workflows/daily-feed.yml` and `weekly-edition.yml`.
They just need two secrets:

1. GitHub repo → Settings → Secrets and variables → Actions → New secret:
   ```
   INGEST_BASE_URL       https://thedesk.au   (or your Railway URL, no trailing slash)
   SCHEDULED_API_KEY     <same value as on Railway>
   ```

2. **Test manually.** Actions tab → Daily feed ingest → Run workflow → main branch. Watch the logs — it should fetch ~18 items from RSS feeds, POST to your live site, and exit clean.

3. **First scheduled run.** Daily fires at 20:00 UTC (~06:00 Sydney AEST). Weekly fires at 21:00 UTC Saturday (~07:00 Sunday Sydney AEST).

---

## 6. Sign in to the admin

1. Open `https://thedesk.au/login`.
2. Type the `ADMIN_PASSWORD` you set on Railway.
3. If `ADMIN_TOTP_SECRET` is configured, enter your authenticator code too. Sessions last 12 hours; logout and password rotation revoke access. See [security rollout and MFA enrollment](docs/security-remediation.md). You can:
   - Manage featured LinkedIn posts at `/admin`
   - Regenerate Ruben's Take or hero images per edition
   - Run the `feed.backfillSayThis` admin mutation

The public site is open to everyone. Only `/admin` and the admin-gated tRPC
procedures require the session cookie.

---

## 7. (Optional) Analytics + error monitoring

These don't need code changes for the analytics services — they're a single
script tag in `index.html`. Add when you're ready to start watching traffic.

**Plausible:** Dashboard → Add a site → copy the `<script>` tag → paste into
`client/index.html` before `</head>`.

**Sentry:** Install `@sentry/node` and `@sentry/react`, initialize in
`server/index.ts` and `client/src/main.tsx`. Sentry's quickstart shows the
exact lines. Free tier is plenty for a personal site.

---

## 8. Backups, disaster recovery & staging

Once you have real subscribers and live content, the difference between "a bug"
and "a bad week" is whether you can restore and whether you can rehearse a
change before it hits production.

### Backups (TiDB Serverless)

TiDB Serverless backs the cluster up automatically — you don't have to wire
anything, but you do have to know how to use it:

1. **Automatic snapshots + PITR.** TiDB Cloud Console → your cluster → Backup.
   Serverless keeps automatic daily snapshots and supports Point-in-Time
   Recovery within the retention window. Confirm the retention period on your
   plan and treat it as your **RPO** (how much data a worst-case restore loses).
2. **Restore = a new cluster.** A restore provisions a *separate* cluster from
   the snapshot; it doesn't overwrite the live one. Recovery is therefore:
   restore → grab the new `DATABASE_URL` → point Railway at it → redeploy.
   Walk this once now so the **RTO** (time to recover) is known, not guessed.
3. **Off-platform copy (optional but cheap insurance).** For an independent
   backup you control, periodically dump with Dumpling or `mysqldump`:
   ```sh
   mysqldump --set-gtid-purged=OFF --single-transaction \
     -h <host> -P 4000 -u <user> -p <db> | gzip > thedesk-$(date +%F).sql.gz
   ```
   Store it somewhere outside TiDB Cloud (R2/S3). This is your fallback if a
   cluster-level issue ever makes the in-platform snapshots unreachable.

### Staging environment

Run schema changes and risky deploys somewhere that *isn't* in front of
readers first. The app's auto-migrate-on-boot (`runCatchup`) makes staging a
true rehearsal: boot the new code against a copy of the schema and watch the
migration apply before you ship it to production.

1. **Separate database.** Either create a second Serverless cluster
   (`the-desk-staging`) or use a **TiDB branch** of production (Console →
   Branches) for a fresh copy of the schema/data. Never point staging at the
   production `DATABASE_URL`.
2. **Separate Railway service.** Add a second service from the same repo,
   deploying from a `staging` branch. Give it its **own** secrets — a distinct
   `JWT_SECRET`, `ADMIN_PASSWORD`, and the staging `DATABASE_URL`. Keep
   `NODE_ENV=production` so it exercises the real code paths (security headers,
   fail-loud env, no demo fallback).
3. **A non-indexed domain.** Use the default `*.up.railway.app` URL or a
   `staging.thedesk.au` subdomain. Don't link it publicly.
4. **Promotion flow.** Merge to `staging` → verify on the staging service →
   then merge `staging` into your production branch. Railway auto-deploys each
   on push.

---

## What's NOT yet wired (deferred to v2)

- **Email delivery** (Resend). The subscribers list captures double-opt-in
  emails but no email actually goes out. To send the confirmation email and
  the daily digest, wire `server/core/email.ts` against Resend's API.
- **Stripe** for paid tier (premium subscribers).
- **Image hot-link caching.** Right now feed cards hot-link `og:image` from
  source sites. At scale that breaks when sources rotate URLs — eventually
  scrape once + cache to Cloudflare R2.

These are real features, but you don't need them to ship. Get the site live
first, then add what the user feedback actually demands.

---

## Cost forecast

| Subscribers | Monthly cost |
|---|---|
| 0 | ~$5 (Railway) |
| 1,000 | ~$25 (Railway + Anthropic + analytics) |
| 10,000 | ~$80 (+ email delivery) |
| 50,000 | ~$350 (+ scaled email + scaled hosting) |

LLM costs scale with content volume, not subscribers — so the big jumps
above are mostly email + analytics + hosting tier, not Anthropic.
