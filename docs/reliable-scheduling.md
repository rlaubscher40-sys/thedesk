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
`instagram-daily` 07:13, `instagram-insights` 07:17, `instagram-coverage` 12:13,
`weekly-edition` Sun 07:17, `instagram-weekly` Sun 09:19.

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
