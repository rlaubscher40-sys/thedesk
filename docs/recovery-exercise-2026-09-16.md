# TiDB recovery exercise · 16 September 2026

## Result and scope

An actual TiDB snapshot was restored into a separate Starter instance in the owner's authenticated account. Read-only SQL recovered application tables and representative data. Production was not overwritten, its connection configuration was not changed, and no application, scheduler, email sender or social publisher was connected to the recovery copy.

Operator: Codex acting under Ruben Laubscher's standing instruction to fix and verify the operation; Ruben completed provider sign-in. Evidence came from the authenticated TiDB console and SQL Editor, the deployed repository schema, and public production health checks. This is an operator record, not independent certification or an owner signature.

| Item                               | Observed evidence (UTC)                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| Source                             | `the-desk`, TiDB Starter v8.5.3, AWS Singapore                    |
| Backup                             | Succeeded, 2026-09-15 18:00:15                                    |
| Schedule and retention             | Daily at 18:00; one day; snapshot expiry 2026-09-16 18:00:15      |
| Restore target                     | `desk-restore-20260916`, same provider/region, new instance       |
| Spending limit                     | $0.00 maximum/month; no credit card required                      |
| Restore submitted                  | 2026-09-16 16:19:27.423                                           |
| Representative data reads verified | 2026-09-16 16:21:23.054; 1 minute 55.631 seconds after submission |
| Active status observed             | By 2026-09-16 16:23:15.384                                        |
| Backup age at submission           | Approximately 22 hours 19 minutes                                 |
| Production health after exercise   | Six checks passed at 2026-09-16 16:24:11.233                      |

The observed read-recovery duration excludes incident detection, login, diagnosis, configuration, cutover and resuming external services. It is not a full application recovery-time objective. A daily snapshot can lose roughly a day's changes; a failed next backup can leave a larger gap. One-day retention does not provide a useful multi-day corruption recovery window.

## Read-only verification

Both databases exposed 40 application tables. Metadata checks found 317 columns and 81 index-column entries on each side. Bounded CRC32/XOR metadata signatures matched: columns `1206801433`, indexes `2134904179`. These are useful drift checks, not cryptographic proof that all data is identical.

Exact `COUNT(*)` results, rather than estimated `information_schema.TABLE_ROWS` values:

| Dataset                   | Restored snapshot | Current production |
| ------------------------- | ----------------: | -----------------: |
| Stories                   |             4,108 |              4,192 |
| Editions                  |                17 |                 17 |
| Current metrics           |                64 |                 64 |
| Subscribers               |                 8 |                  8 |
| Job records               |               916 |                988 |
| Instagram post records    |               221 |                223 |
| Publication controls      |                 0 |                  0 |
| Subscriber consent events |                 0 |                  0 |

Production reads occurred around 16:24 UTC, after the snapshot. Differences are recorded, not silently treated as corruption or proven to consist exclusively of post-snapshot inserts. No backup-time row manifest was available.

- Both copies have six confirmed, non-unsubscribed subscribers and one unsubscribed subscriber. Neither has a confirmed subscriber with a pending confirmation token. Email addresses, names and token values were not retrieved.
- Both copies have zero recorded consent-request timestamps and notice versions. These legacy gaps were preserved; no consent evidence was invented or backfilled. Historical opt-in evidence remains an owner/provider review item.
- The recovered job table has no duplicate `(jobKey, runDate)` pairs and includes 19 successful `Published media` records. The recovered delivery table has no duplicate `(feedDate, subscriberId)` pairs.
- All 24 recovered daily-brief deliveries have the application's valid `accepted` status and cleared payloads. An initial diagnostic used an incorrect status vocabulary; code review and the grouped status query resolved it. No invalid-delivery finding is claimed.
- Recovered edition topic/signal JSON validates. The zero-row publication-control and consent-event tables establish schema availability only; they cannot demonstrate recovery of a non-empty hold or consent audit trail.
- Production `/api/healthz` returned 200 with database readiness and `Cache-Control: no-store`; three private health endpoints denied anonymous access with 403; the homepage returned its application shell.

## Repeatable procedure and cutover safeguards

Use [the read-only SQL checks](../scripts/ops/recovery-checks.sql) in the provider's SQL Editor on the explicitly selected recovery instance. Run individual statements and retain only aggregate results. Check instance identity before each query. SQL reads alone do not exercise complete browser journeys.

1. Record source identity, successful backup time, expiry, intended recovery point and a separate target name. Confirm the provider's current cost summary. Never restore over the live instance as an exercise.
2. Restore to a new account-controlled instance with a $0 cap when eligible. Keep all application deployments and outbound integrations disconnected. Do not run app startup casually: startup schema catch-up can write even when the scheduler is disabled.
3. Record submission and first successful read times, provider completion status, schema checks, exact counts and consent/publication state. Compare with a backup-time manifest where available; current production counts are a later reference, not an exact expected snapshot.
4. Before a real cutover, reconcile all post-snapshot unsubscribes/deletions, editorial holds/corrections and accepted email/social publication receipts against surviving authoritative records. Keep outbound sending and publishing disabled until this is complete. Replaying old job locks can duplicate publication; restoring old consent state can wrongly reactivate a recipient.
5. Verify the isolated application with external integrations disabled before any separately approved production connection switch. Record full service recovery time and discrepancies, then verify public reads and access boundaries after cutover.
6. Retain the test copy only while needed for review. This exercise leaves `desk-restore-20260916` isolated at $0. Permanent deletion is a separate confirmed cleanup action, not part of this record.

## Remaining provider decisions

Production showed **57.5M request units** and a **92%** quota progress bar with “Quota almost exhausted.” These console readings are recorded as displayed; no exhaustion date or internally consistent quota denominator is inferred. The live instance was active and public database readiness passed.

The production spending screen requires **Add Credit Card**. Its default proposed limit was **$10/month**, with no upfront charge and usage charged beyond the free allowance. A $5 draft was also inspected and cancelled. No spending limit or card was submitted. The provider warns that reaching the limit can make the instance inaccessible. Capacity approval remains an owner decision; a capped plan still needs usage monitoring.

Backup settings were disabled with the instruction to set a spending limit before customising retention. Longer retention has not been enabled or priced. The provider's [Starter pricing page](https://www.pingcap.com/tidb-cloud-starter-pricing-details/) confirms that qualifying instances receive separate free quotas, which allowed this second-instance test without sharing the source instance's quota. Region-specific account pricing takes precedence over generic examples.

Actual phone/browser checks, account MFA/recovery ownership, rights/billing evidence and sustained audience/monitoring outcomes remain open under the operation programme. A successful database restore does not close those unrelated items.
