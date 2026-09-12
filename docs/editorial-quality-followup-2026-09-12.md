# Editorial quality and diagnosis follow-up · 12 September 2026

PR #251 is deployed; its ASX/APRA corrections and PIPA links were verified publicly. The Bega, Tasmania levy and packaging reports remain unconfirmed in the latest feed. This follow-up addresses additional verified defects, without treating missing publication as proof of failed discovery.

## Verified sample

The 38-row public feed contained four pages whose primary purpose is not a consequential news development:

- 3870038: [ABC's single cottage purchase account](https://www.abc.net.au/news/2026-09-11/first-homebuyer-wins-malanda-cottage-lowest-bidder/107138396). Its first-home-buyer vocabulary passes the existing policy gate even though the headline concerns one purchase.
- 3870024: [Guardian rental-application advice](https://www.theguardian.com/lifeandstyle/2026/sep/12/how-to-improve-your-chances-of-getting-a-lease-renting-application). General application guidance, not a policy announcement.
- 3870034 and 3870033: TechCrunch event-hosting/exhibitor invitations. The [exhibitor page](https://techcrunch.com/2026/09/11/one-week-left-to-book-your-exhibit-table-at-techcrunch-disrupt-2026/) asks readers to book space.

The conservative format rules detect these four pages. Explicit legal/rights developments, first-home-buyer policy, market-wide auction data and product announcements remain eligible for the ordinary evidence gates. Startup quarantine is reversible, retains IDs and notes, checks old values, and applies Australian topic rules only to Australian lanes. Only the new format rules apply to other lanes.

## Diagnosis defects

Article fetching previously returned the same null text for HTTP denials, unsupported media, network failures and timeouts. The pipeline therefore reported an editorial text shortage when the original had never been read. Keep normalised operational failure reasons distinct and carry them into the saved decision report. No additional retry or access bypass is introduced.

Add complete decision outcome totals before truncating detailed entries to 300. The totals cover unique recorded candidates; duplicate feed appearances are not extra decisions. Old reports remain readable and remain identified as sampled. Display totals in the protected admin console and emit bounded operational summaries without article bodies, credentials or full URLs. Hourly evidence failures now name the source and reason rather than only a failure count.

## Verification

The live-feed replay detects the four intended cards. Focused tests cover negative cases, typed fetch failures, complete counts beyond the retained sample, backward-compatible reports and named source failures. CI also exercises the isolated database quarantine test across Australian and international lanes, including idempotence and retention of notes.
