# Local source access pauses

SA's production collector returned HTTP 403 on 9 September 2026. Its second
attempt generated a terminal scheduler alert. A normal retry cannot resolve
explicitly denied publisher access.

Local dataset health now acts as a persistent access pause for publisher HTTP
401/403. The scheduler skips a paused source before claiming another run, across
days and restarts. The collector also checks health directly, protecting other
entrypoints. Existing legacy `Publisher HTTP 403` rows are recognised immediately.
No new source request is necessary to pause the known SA failure.

A newly encountered denial is saved in health and recorded as a failed attempt,
not successful collection. It suppresses the futile terminal retry email for that
access denial only. Admin explicitly shows the source as paused and retains its
error, reporting period and last stored snapshot. Successful check timestamps are
not advanced. HTTP 429/5xx, timeouts, schema failures and failed writes remain
ordinary errors and retain their retry/alert behaviour.

New download errors distinguish `Source discovery` from `Data download` and
identify the publisher hostname. Query strings, credentials and response bodies
are not logged. The historical SA error does not contain enough information to
identify which step was rejected; do not infer it.

## Resuming a source

There is deliberately no timed retry of denied access. First establish permitted
access or review and implement a licensed replacement. Then an operator can clear
that source's `local_data_health.error` field without changing its `checkedAt`,
`lastSuccessAt` or snapshots. Check the schema's actual table/column names before
performing any database operation. A failed run that exhausted today's attempts
will next be eligible on the following Sydney date. Do not delete collection
leases or change attempt budgets to force a retry.

Verify the next fetch and snapshot storage in production. Removing an error or
merging code alone does not establish successful automatic updates. See issue
#197 for the source and reproduction evidence.

## Reviewed SA release

The June 2026 SA Housing Trust workbook was downloaded successfully through its
ordinary public URL during the source review, saved at 2026-09-09T08:26:23.209Z,
before the production access failure was observed. Its CKAN package explicitly
specifies Creative Commons Attribution 4.0:
https://data.sa.gov.au/data/api/3/action/package_show?id=private-rent-report
https://creativecommons.org/licenses/by/4.0/

Original resource:
https://data.sa.gov.au/data/dataset/8eb97a72-9919-448b-8de6-fc1530b3f7ec/resource/b4aa86f1-7efa-4690-9793-bd36df97ad29/download/private-rental-report-2026-06.xlsx

Workbook SHA-256:
`9ed02e20fe38a40827246501f3ee9a26111d8a8cf32b90b2b8ec15e8c7d9a20e`

`scripts/import-sa-reviewed.mts` builds the bundled aggregate from this exact
file using the production parser. The snapshot contains 881 source-defined areas
and 510 published category medians. It preserves suppression, rounded bond
counts and the June reporting period; it excludes ten split-postcode rows.
This is reused openly licensed data already obtained, not a new download path
around the production refusal. No publisher request runs during import.

The separate, fenced `local-data-sa-reviewed-release` job only imports when SA
has no snapshot. It never replaces an existing release, resets a source error,
advances a successful-fetch timestamp or reuses the failed downloader's retry
budget. Failed writes remain failures. Markets, Ask evidence and Admin identify
the reviewed import and retain its actual reporting/retrieval dates. A later
successful ordinary collection supersedes this provenance naturally.
