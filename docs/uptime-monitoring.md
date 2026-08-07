# Uptime monitoring

## The problem

`/health` uptime history was fed by a GitHub Actions workflow with
`cron: "*/5 * * * *"`. It never ran every 5 minutes. Measured across 3 days
in August 2026, the actual intervals between runs were:

```
57, 58, 63, 75, 79, 81, 84, 86, 91, 91, 93, 97, 98, 98, 99, 99,
101, 118, 124, 131, 134, 156, 161, 166, 169, 198, 199, 346   (minutes)
```

Median ~99 minutes. GitHub deprioritises `schedule:` workflows on free public
repos, and this one asked for 288 runner allocations a day. Two of those
allocations timed out entirely — jobs queued for exactly 15 minutes with
`runner_id: 0`, then cancelled, producing "Uptime check: All jobs were
cancelled" failure mail for an outage that never happened. The site was up
the whole time; the workflow just never got a machine to run on.

Two consequences beyond the noise:

- `listRecentUptimePings(limit = 288)` in `server/db/health.ts` is sized for
  24h at 5-minute spacing. At ~14 pings/day it was actually spanning ~3 weeks.
- `uptimeWindowStats(24)` averaged over ~12–16 samples, so a single bad ping
  read as ~93% uptime.

This is the same best-effort-cron problem that moved the daily jobs in-process
(`docs/reliable-scheduling.md`). Uptime needed a different answer, because the
whole point of an uptime check is to keep working when the app doesn't.

## The fix: sample from inside, detect outages from outside

Two halves, deliberately paired. Neither is sufficient alone.

### 1. Dense samples — `server/scheduler/uptimeSampler.ts`

A plain 5-minute interval in the always-on server. Every tick it GETs its own
**public** URL (`SITE_URL/api/healthz`), so the measurement exercises DNS, TLS
and the Railway edge the way a reader does, then writes a row with
`source: "self"`.

It is not a `job_runs` watermark job like the daily jobs are: there's no
"today's run" to claim, a missed sample is worthless after the fact, and
double-sampling across replicas is harmless.

A probe that fails records `statusCode: 0`, which distinguishes "we asked and
got nothing" from "we never asked".

This restores the 288 samples/day the panel was built for, so the existing
window constants are correct again — no change needed there.

**Its limitation is structural:** it runs inside the app, so it records
nothing while the app is down. That is exactly what half 2 is for.

### 2. Outage truth — `POST /api/uptime/webhook`

An external monitor watches the site and posts up/down transitions here.
This is the only source that can observe the app being down.

**Uptime services fire webhooks on state change, not on every check.** Expect
a couple of rows a month from this endpoint, not one every 5 minutes. It is
not a replacement for the sampler; it fills the sampler's blind spot.

`server/core/uptimeWebhook.ts` normalises three payload shapes, so the same
URL works whichever service you pick:

| Service | Recognised by | Notes |
| --- | --- | --- |
| UptimeRobot | `alertType` field | `1` = down, `2` = up, `3` = SSL expiry (ignored — an expiring cert is not an outage). Status code parsed out of `alertDetails` prose when present. |
| Better Stack | `data.attributes` | `resolved_at` set = recovered. Uses `response_code`, falling back to a code parsed from `cause`. |
| Anything else | `statusCode` field | Same shape as `/api/uptime/record`. For cron-job.org, a script, or a hand-rolled probe. |

An unrecognised body gets a `400` rather than being silently recorded as a
200 — a webhook we can't read is a broken monitor, and the panel shouldn't
imply otherwise. The failure shows up in that service's own delivery log.

## Setup (required — do this, or outages go undetected)

Retiring the cron means **nothing is currently watching from outside**. The
sampler covers history; it cannot page you when Railway falls over. Pick one:

**UptimeRobot** (free: 5-minute checks, 50 monitors)

1. Add a monitor → HTTP(s) → `https://thedesk.au/api/healthz`.
2. Alert contacts → Add → Webhook.
   - URL: `https://thedesk.au/api/uptime/webhook?key=YOUR_SCHEDULED_API_KEY`
   - POST, send as JSON.
3. Attach that contact to the monitor.

**Better Stack** (free: 3-minute checks)

1. Monitors → Create → `https://thedesk.au/api/healthz`.
2. Integrations → Webhook → same URL as above.

### About the key in the query string

The endpoint accepts `SCHEDULED_API_KEY` in the `x-scheduled-key` header
(preferred) **or** a `?key=` query param. The query form exists because
UptimeRobot's free tier can set the webhook URL but not custom headers. It is
the weaker of the two — query strings land in access logs and referrer
headers — so use the header if your service supports it; the header wins when
both are present. The route has its own 20/min/IP rate limiter for this
reason.

Rotating the key means updating it in Railway **and** in the monitor.

## Environment

| Var | Effect |
| --- | --- |
| `ENABLE_SCHEDULER=true` | Required. The sampler shares the scheduler's rollout switch. |
| `UPTIME_SAMPLER=false` | Optional opt-out: keeps the daily jobs, drops the sampling. |
| `SITE_URL` | What the sampler probes. Falls back to `VITE_SITE_URL`, then `https://thedesk.au`. |
| `SCHEDULED_API_KEY` | Authenticates both `/api/uptime/record` and `/api/uptime/webhook`. |

## Manual probe

`.github/workflows/uptime.yml` still exists as `workflow_dispatch` only, so
you can get an off-Railway probe on demand from the Actions tab. Its
`schedule:` block is gone — that was the source of the phantom failure mail.

## Verifying

- Server log at boot: `[uptime] sampling https://thedesk.au/api/healthz every 5m`
- After ~10 minutes, `/admin` → health panel should show rows with
  `source: "self"` roughly 5 minutes apart.
- Webhook: pause the monitor or point it at a deliberately bad path to force a
  state change, then check for a `source: "uptimerobot"` / `"betterstack"` row.
