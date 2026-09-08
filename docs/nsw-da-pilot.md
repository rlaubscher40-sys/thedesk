# NSW Online DA pilot

This pilot validates an authorised export against the NSW Planning Portal's
official Online DA API field contract before any value reaches The Desk.

It is deliberately not scheduled yet. The official API requires a subscription
key, and the dataset catalogue directs users to the NSW Data Broker to request
access. No key or dataset request was created for this work.

## Safety boundaries

- The Planning Portal application number remains the record identity.
- Council is stored as an LGA geography; it is not silently relabelled as a city.
- Lodgement and determination dates remain separate.
- Proposed dwelling counts exclude modification and review records to avoid
  obvious double-counting.
- A `Determined` record is not called approved: the published field contract
  does not expose an approved/refused outcome.
- Proposed dwellings are not described as construction starts or completed homes.
- Windows before 1 July 2021 carry the official missing-case warning.
- Retrieval time is not presented as the source's publication or revision date.

## Run the credential-free validator

```sh
pnpm probe:nsw-da export.json "Council of the City of Sydney" 2026-08-01 2026-08-31
```

The input must be a JSON array using the exact official field names. The command
only validates and prints a snapshot; it does not write to the database.

## Production gate

Before scheduling ingestion, obtain explicit approval to request/configure the
official subscription, capture a real response fixture, confirm pagination and
rate limits, then re-run the contract tests against that fixture. The production
path should keep the existing scheduled-key protection and store dated snapshots
so later source revisions remain visible.

Official references:

- Dataset: <https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api>
- API access: <https://www.planningportal.nsw.gov.au/API>
- Data dictionary: <https://www.planningportal.nsw.gov.au/opendata/dataset/88c61ad1-7096-45ae-b1ac-94963e4cfca1/resource/95279ab6-b115-4300-bb21-30461dae3985/download/online-da-api-v2.0.pdf>
