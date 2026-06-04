# Reliable scheduling (don't trust GitHub cron alone)

## The problem

The daily jobs (`daily-metrics`, `daily-feed`, `instagram-daily`,
`instagram-coverage`, …) are wired as GitHub Actions `schedule:` crons.
GitHub's scheduled trigger is **best-effort**: in practice it fires our
jobs **~1.5 hours late**, and it **silently drops runs entirely** during
load (e.g. 3 Jun 2026 had no daily run at all). The workflows themselves
are configured correctly — the scheduler is the weak link.

For daily, business-critical output (the subscriber brief, the Instagram
posts) that's too flaky. The fix is to drive the workflows from a
**punctual external scheduler** that calls GitHub's `workflow_dispatch`
API, and let GitHub only *run* the job, not *time* it.

## How it works

An external cron service (e.g. [cron-job.org](https://cron-job.org),
EasyCron, Pipedream, or any host with real cron) sends an authenticated
`POST` to GitHub at the scheduled time. GitHub immediately starts the
workflow (which runs the same ingest/post script as today).

```
POST https://api.github.com/repos/rlaubscher40-sys/thedesk/actions/workflows/<FILE>.yml/dispatches
Headers:
  Accept:               application/vnd.github+json
  Authorization:        Bearer <GITHUB_TOKEN>
  X-GitHub-Api-Version: 2022-11-28
  User-Agent:           thedesk-scheduler
Body:
  {"ref":"main"}
```

A `204 No Content` response means it was accepted.

## One-time setup

### 1. Create a fine-grained GitHub token
GitHub → Settings → Developer settings → **Fine-grained personal access
tokens** → Generate new token.
- **Resource owner:** `rlaubscher40-sys`
- **Repository access:** Only select repositories → `thedesk`
- **Repository permissions:**
  - **Actions:** Read and write  ← required to dispatch
  - Metadata: Read-only (auto-selected)
- Set a long expiry (or calendar a rotation reminder).

Copy the token. Store it **only** in the cron service's secret/header
field — never commit it.

### 2. Create one cron job per workflow
Schedule each in **Australia/Sydney** time (cron-job.org supports a
timezone per job, which also handles AEST/AEDT daylight saving — something
the UTC crons in the repo can't). Same method/headers/body for all; only
the URL `<FILE>` and the time differ.

| Workflow file | Sydney time | Purpose |
|---|---|---|
| `daily-metrics.yml` | 06:33 daily | Market metrics (run first) |
| `daily-feed.yml` | 06:43 daily | Daily feed + subscriber brief |
| `instagram-daily.yml` | 07:13 daily | AU/Property carousel |
| `instagram-insights.yml` | 07:17 daily | IG insights pull |
| `instagram-coverage.yml` | 12:13 daily | "Wider Lens" carousel |
| `weekly-edition.yml` | Sun 07:17 | Weekly edition synthesis |
| `instagram-weekly.yml` | Sun 09:19 | Weekly edition carousel |

(`uptime.yml` runs every 5 min and is fine left on GitHub cron — it's not
date-critical and re-dispatching it externally would be overkill.)

### 3. Verify
Trigger one job from the cron service manually and confirm a run appears
under the repo's **Actions** tab with event **workflow_dispatch**.

### 4. Remove the GitHub `schedule:` triggers  ⚠️ do this only after step 3 works
Once the external cron is confirmed, delete the `schedule:` block from
each workflow above (keep `workflow_dispatch:` so manual runs and the
external trigger still work). **This matters:** if both GitHub cron *and*
the external cron fire, the job runs twice a day — and the metrics ingest
is **not idempotent**: `upsertDailyMetric` appends a sparkline history
point on every run (`server/db/dailyMetrics.ts`), so a double run
double-counts that day's history. One scheduler, one run.

> Ask and this repo's maintainer/assistant can strip the `schedule:`
> blocks in a single commit once your external cron is live.

## Alternative: Railway cron
Railway (the host) can run scheduled commands in the service. You could
run `pnpm ingest:metrics` / `pnpm ingest:daily` etc. directly on Railway's
scheduler instead of GitHub Actions. This keeps everything in one place
and is more reliable than GitHub cron, but it consumes Railway minutes and
needs the repo's dev dependencies available in the service. The external
`workflow_dispatch` approach above is lower-touch and keeps the existing
Actions logs/visibility, so it's the recommended default.
