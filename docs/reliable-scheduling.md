# Reliable scheduling

## The problem
The daily jobs were timed by GitHub Actions `schedule:` cron, which is
best-effort: in practice it fired our jobs **~1.5 h late** and **silently
dropped** runs (3 Jun 2026 had none). The workflows are fine — the *scheduler*
was the weak link.

## The fix (implemented): an in-process, self-healing scheduler
`server/scheduler/` runs inside the always-on server. It's a **watermark +
catch-up loop**, not a fire-at-time-T timer:

- Every 5 minutes (and ~15 s after boot) it asks, per job: *"is it past this
  job's Sydney time today, and has today's run not been claimed?"* If so it
  claims the run (atomically, via the `job_runs` table) and runs it.
- **Self-healing:** a redeploy, a brief outage, or a missed minute can't drop a
  day — the job runs as soon as the server is up and notices it's overdue.
- **Exactly once/day**, even across replicas or overlapping ticks — the
  `(jobKey, runDate)` unique key means one claimer wins; a failed run is
  re-claimed up to 3 times so transient failures self-heal.
- **No external dependencies, no token to expire.** Sydney time is computed
  with the platform tz database, so DST is handled (no UTC drift).

How jobs run (all against the server's own loopback):
- `daily-feed` / `daily-metrics` import the ingest's pure run-function and point
  it at `127.0.0.1`, so the RSS fetch + enrichment happens in-process.
- `instagram-*` and the weekly synthesis POST the existing scheduled endpoints
  on loopback (authenticated with `SCHEDULED_API_KEY`).

Jobs + Sydney times: `daily-metrics` 06:33, `daily-feed` 06:43,
`instagram-insights` 07:17 daily; `weekly-edition` Sunday 07:17.
Social publication slots are defined once in `shared/instagramSchedule.ts` and
used by the server and admin UI:
- Property briefing: Mon–Fri 07:30.
- Number card: Tue/Thu 12:30, except the 1st when the monthly review replaces it.
- Weekly edition: Sunday 09:30.
- Monthly review: 1st at 12:30, restricted to existing eligible property metrics.
- Verified Reels: eligible new topics 18:30–20:00, at most one per Sydney day.

Feed jobs allow 60 minutes of catch-up; after that the slot is skipped. Reels
are checked every five minutes within their evening window. Rendering and Meta
processing add latency; these times are earliest starts, not exact publication
promises. Existing job/publication identities are unchanged, so moving a slot
does not reopen today's completed job or a confirmed/uncertain Reel month.

`instagram-coverage` ("The Wider Lens") is deliberately absent because it is
broader than the property proposition. Its endpoint and admin button remain
manual. We have not established a causal relationship between posting frequency
and reach. See `docs/australian-social-rhythm.md` for the trial and design rules.

## Rollout (deliberate, safe)
It ships **off by default** (`env.enableScheduler`), so merging changes nothing
until you switch it on. Cut over in one step so jobs never run twice (the GitHub
cron and the scheduler must not both fire — IG would double-post, metrics would
double-count its sparkline history):

1. **Set `ENABLE_SCHEDULER=true`** on Railway (Service → Variables) and redeploy.
2. **Remove the GitHub `schedule:` triggers** from the daily/weekly workflows
   (keep `workflow_dispatch:` for manual runs) so only the scheduler fires. Ask
   and this can land as one commit at the same time you flip the flag.
3. **Verify:** next morning, check the server logs for `[scheduler] … ✓` lines,
   or the `job_runs` table for that day's rows. `SCHEDULED_API_KEY` must be set
   (it already is) or the scheduler logs a warning and won't start.

Rollback is trivial: unset `ENABLE_SCHEDULER` (and/or re-add the cron blocks).
`workflow_dispatch` stays on every workflow, so you can always trigger a job by
hand from the Actions tab regardless.

## Alternative (not used): external cron → workflow_dispatch
A punctual external service (cron-job.org, etc.) can `POST` GitHub's
`workflow_dispatch` API on schedule. Reliable, but adds a third-party
dependency and a fine-grained token (Actions: read/write) that silently fails
when it expires — which is why the in-process scheduler is preferred.
