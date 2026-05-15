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
   OPENAI_API_KEY        sk-...                                   (for AI image gen)
   SCHEDULED_API_KEY     <openssl rand -hex 32>                   (for GitHub Actions ingest)
   ```

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

6. **Verify it's live.** Visit `https://<your-railway-domain>.up.railway.app` — you should see the demo page (the site falls back to demo data on the first visit because the DB tables are empty until the first ingest).

---

## 4. Custom domain

1. Railway → Settings → Networking → Custom Domain → add `thedesk.com.au` (or whatever you bought).
2. Railway gives you a CNAME target. Copy it.
3. At your registrar (or Cloudflare if you use it for DNS), add a CNAME:
   ```
   thedesk.com.au   CNAME   <railway-target>.up.railway.app
   www              CNAME   <railway-target>.up.railway.app
   ```
4. Wait 5-30 minutes for DNS to propagate. Railway auto-issues a Let's Encrypt cert.

---

## 5. GitHub Actions — daily + weekly ingest

The repo already ships `.github/workflows/daily-feed.yml` and `weekly-edition.yml`.
They just need two secrets:

1. GitHub repo → Settings → Secrets and variables → Actions → New secret:
   ```
   INGEST_BASE_URL       https://thedesk.com.au   (or your Railway URL, no trailing slash)
   SCHEDULED_API_KEY     <same value as on Railway>
   ```

2. **Test manually.** Actions tab → Daily feed ingest → Run workflow → main branch. Watch the logs — it should fetch ~18 items from RSS feeds, POST to your live site, and exit clean.

3. **First scheduled run.** Daily fires at 20:00 UTC (~06:00 Sydney AEST). Weekly fires at 21:00 UTC Saturday (~07:00 Sunday Sydney AEST).

---

## 6. Sign in to the admin

1. Open `https://thedesk.com.au/login`.
2. Type the `ADMIN_PASSWORD` you set on Railway.
3. You're now signed in for a year. You can:
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
