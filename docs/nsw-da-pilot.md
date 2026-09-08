# NSW Online DA pilot

The public read-only feed is **free and requires no credentials**. On 8 September
2026 the NSW Data Broker confirmed CC-BY attribution, no access cost, no keys,
no sandbox and no published usage limit. This supersedes the earlier assumption
that the public feed required the separate council integration subscription.

## Verified public interface

- `GET https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA`
- Headers: `PageSize`, `PageNumber`, and `filters` containing
  `{"filters":{"CouncilName":["Council of the City of Sydney"],"LodgementDateFrom":"2026-08-01","LodgementDateTo":"2026-08-31"}}`.
- Response: `PageSize`, `PageNumber`, `TotalPages`, `TotalCount`, `Application`.
- Verified against the department's `Swithboard_Data_Apis_PROD Copy 5` Postman
  collection supplied with its email. Postman is optional; no account is needed.
- The live wire format uses nested `Council.CouncilName`, ISO calendar dates,
  title-cased application types and optional dwelling counts. The original flat
  dictionary-export validator remains separate and unchanged.

The source also offers OnlineCDC, OnlineCC and OC endpoints. They are not wired
into this pilot. Major Projects has no public API according to the broker's reply.

## Product behaviour

Signals has a dedicated City of Sydney **council area** section, not a Greater
Sydney or statewide total. It reads the previous complete Sydney-calendar month
on demand, with six-hour caching and single-flight requests. A recent stored
snapshot can satisfy a request after a restart without another API call.

Every page must match the requested council, dates, metadata and row counts.
Duplicate PAN identities, unknown status/type values, invalid dates, changing
pagination, more than 1,000 records, oversized bodies or a 20-second total timeout
make the snapshot unavailable. No partial result is published. The public query
accepts no custom filters, URLs or council names.

Original applications, modifications and reviews stay separate. Only original
applications contribute to the **reported** dwelling subtotal. Omitted dwelling
counts remain null and field coverage is shown alongside the number. A determined
record is not called an approval. Proposals are not construction starts or
completed homes; numeric counts supply no causal claim about prices or rents.

## Revisions and storage

`planning_snapshots` stores immutable aggregate snapshots and minimal application
records (PAN, type, council, status, dates, source update stamp, dwelling count).
Addresses, coordinates, owners and attachments are not stored. The complete read
must be persisted before it is exposed publicly. Earlier checks of the same
period are displayed as source revisions, never as month-on-month growth.

The source is updated daily and does not provide an immutable pagination token.
Page/count/identity checks reduce inconsistency but cannot prove an atomic source
vintage. Retrieval times and literal source update timestamps stay distinct.
Failure to read or save returns unavailable; it does not silently serve stale
numbers or estimate missing values.

Migration `0023_planning_snapshots.sql` has a matching boot catch-up statement for
existing production databases. The current production migration-journal caveat
in `server/db/catchup.ts` still applies.

## Evidence and validation

A direct unauthenticated read on 8 September 2026 returned 161 records for
August 2026 in City of Sydney: 92 original applications, 67 modifications and
2 reviews. Of the 92 originals, 33 reported dwelling counts (268 in total), while
59 omitted them. These are a retrieved example, not permanently current figures.
`server/planning/nswDa.fixture.json` preserves a four-record projection with
attribution. Tests cover wire identity, missing-versus-zero fields, pagination,
limits, geography, period, safe persistence, revisions and reader-facing caveats.

The older offline export validator still runs with:

```sh
pnpm probe:nsw-da export.json "Council of the City of Sydney" 2026-08-01 2026-08-31
```

Source: <https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api>.
Attribution: © State Government of NSW and NSW Department of Planning, Housing
and Infrastructure 2021. CC BY 4.0. The Desk aggregates source records.
