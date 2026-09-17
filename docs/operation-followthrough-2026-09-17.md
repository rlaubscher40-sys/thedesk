# Operation follow-through · 17 September 2026 (Sydney)

Continues the operation programme from main `efab66ba440cf6fef8a4cd5cab3ac1f2fd672ecf`. Ruben deferred Cloudflare access until next week; domain changes are excluded from this release. This is a bounded audit and repair record, not a new whole-operation score.

## Live evidence and repairs

- Read the public feed for 15–17 September: 77, 80 and 17 records respectively at the audit time. The newest day was still accumulating. These counts are an inventory, not a claim that every source and assertion was verified.
- Source-reviewed Westpac's September Leading Index release and SBS's temporary-migration proposal report against stories 3930101 and 3930102. Correct the repeated index summary, unattributed excerpt and unsupported property/rent/rate interpretations. Exact source URL, feed date and original field matching preserve later editorial revisions. The public corrections log records the material changes. Existing distributed images/emails are not rewritten.
- Excerpt selection now rejects pronoun-only attribution and context-dependent opening sentences, and avoids a repeated finding when the second sentence adds no vocabulary or figures. Regression cases retain changed figures and qualifications. The shared editorial prompt distinguishes proposed migration settings from enacted changes and measured rental effects. These are bounded safeguards, not semantic fact-checking certification.
- Inspected 64 live metrics; ten lacked a source URL: five ABS release metrics and five Yahoo market quotes. Collection now carries the actual requested source URL through persistence. Yahoo quotes require a valid observation time; a missing latest close cannot borrow the following day's timestamp. Existing values are not falsely labelled as newly retrieved. Source links appear as those sources next collect successfully.
- Public social receipts confirm Melbourne Reel `17908474461521259` at 2026-09-16 08:36:19 UTC and its Story share `18185474161365503`. The gallery omitted it because only Sydney had an evidence mapping. Generate mappings for all eight supported capitals and the documentary reading registry; tests cover every active publishing family, receipt dates and unavailable Meta previews. Publication locks and creative approvals are unchanged.
- Exercised live Ask with July 2026 annual CPI rent inflation for Brisbane and Perth. It returned 4.6% and 5.3% respectively with two cited records and the correct annual measure. Following Brisbane's citation opened the requested July period. This checks the bounded CPI route; it does not validate every open-ended model answer.
- Inspected the public reader navigation, market provenance and coverage disclosures. Curator login requires a separate admin password; private analytics were not inspected. Real iPhone, Android, in-app browser and inbox-placement evidence remains separate.

## Provider state

The authenticated TiDB production overview showed the owner-set **$8.00 monthly limit**, current spend labelled **Free**, approximately **58M request units**, and no prior near-quota warning. No spending limit was increased. A cap remains a ceiling, not a guarantee of uninterrupted operation.

The backup table currently lists no snapshots. The first settings view displayed 30 days/00:00, but submission returned a provider network error and the loaded fields showed the prior one-day/18:00 schedule. A retry succeeded: after a full reload, the loaded settings showed **30-day retention, daily at 00:00 UTC**, next backup **2026-09-17 00:00 UTC**. A fresh successful snapshot must still be verified before marking current recovery coverage resolved. Do not interpret the empty table as proof that the earlier restored snapshot never existed. The [16 September restore exercise](recovery-exercise-2026-09-16.md) remains valid historical evidence, and its isolated target remains disconnected.

Provider references: [backup documentation source](https://github.com/pingcap/docs/blob/master/tidb-cloud/backup-and-restore-serverless.md) describes daily snapshots and configurable 1–30 day retention for Starter with a positive limit; [Starter pricing](https://www.pingcap.com/tidb-cloud-starter-pricing-details/) describes the spending ceiling. The console's account-specific result is required evidence of an applied change.

## Release acceptance and follow-up

Local validation passed: 2,672 tests across 340 files, with 52 tests in 17 files skipped for unavailable local integration prerequisites; TypeScript, dead-code and rights-inventory checks passed. The release PR must also pass the full suite, isolated MySQL integration tests, security/rights gates and production build. After deployment verify the exact revision, database health, private-route denial, corrected live stories, public correction entries and Melbourne gallery inclusion. Check new metric provenance after a successful source collection.

| Open evidence                           | Next action / owner                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| www certificate and redirect            | Ruben supplies Cloudflare access next week; then verify both hostnames and Search Console live inspection         |
| Current backup coverage                 | 30-day daily schedule persisted; verify the next successful snapshot, escalating a missed or failed backup        |
| Physical-device and inbox journeys      | Actual phone and authorised-recipient checks; do not substitute component tests for this evidence                 |
| Operator identity, rights, MFA/recovery | Owner supplies account/permission records and resolves the existing legal checklist                               |
| Reader and social outcomes              | Inspect the first seven complete post-release days and matched-age posts; current sparse samples are inconclusive |
| Private curator checks                  | Secure admin sign-in is required; no credentials or authentication bypass in the audit                            |

Rollback uses a new reviewed revert commit and normal deployment. Source-verified database corrections must not be reverted to known-wrong copy. No schema migration or publication replay is introduced.
