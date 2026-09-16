# The Desk: legal and IP foundations

Prepared 14 September 2026. Implementation and legal-review handover, not a legal clearance, executed contract or filing.

Follow-up: [20-point review, implementation and remaining owner decisions](./compliance-checklist-2026-09-16.md). The earlier foundations are merged; wording below describing their original pre-merge status is historical. Identity, permissions and operational verification do not become resolved merely through a merge.

## What this change establishes

- Fixed dates for Privacy and Terms, replacing a date that changed on every visit.
- Privacy copy reflecting newsletter attribution, account/bookmark data, AI questions, public share links, browser storage and service providers. Unsupported promises of absolute anonymity, no sharing and universal 30-day deletion are removed.
- Reuse wording distinguishes original Desk content from third-party assets. Consumer rights are expressly preserved, and an automatic acceptance-by-continuing clause is removed. These pages are draft changes pending review and legal-operator confirmation.
- Every SubscribeBand shows the same newsletter scope and privacy link. The form sends the current notice version; the server accepts only the recognised version or absence for older clients.
- Nullable `consentNoticeVersion` and `consentRequestedAt` preserve the latest request's wording and time after confirmation. Existing `confirmedAt`, `unsubscribedAt` and `source` describe status and placement. Existing records are not backfilled. A new request never restores an unsubscribe without inbox confirmation. A new append-only application event table also records requests, confirmations and unsubscribes from deployment onward, transactionally with state changes. No historical events are invented. Database administrators can still alter records.
- Confirmation emails repeat the scope. Replies are addressed to the contact already published by the site, `ruben@thedesk.au`. Mailbox delivery/monitoring was not independently tested.
- Ask displays an AI collection notice. Generation and independent review instructions reject personal suitability assessments and recommendations involving financial products, specific loans or SMSF establishment/switching. Prompt instructions reduce risk; they are not a licensing determination or guaranteed enforcement.
- All 17 bundled Reel photo records now contain individual source/download evidence, licence reference, credit, purpose, review date and SHA-256. Records reconstructed from earlier documented reviews retain those original dates. Some use gallery-linked individual download evidence because metadata was unavailable; that limitation remains visible.
- Evidence and housing motion renderers refuse altered image bytes. Documentary renderers already check hashes. No new photograph, licence grant or visual treatment was introduced.
- `node --import tsx scripts/legal-audit.ts` produces the rights inventory from current code and installed direct dependency metadata. It checks photo hashes before output. The committed snapshot covers 96 news-discovery routes, 17 photographs and 53 direct dependencies.

## Items still requiring a decision or legal review

| Priority | Item | Evidence and next action |
|---|---|---|
| Now | Legal operator and ownership | No verified company name, ABN/ACN or ownership agreement found. Confirm whether Ruben personally or an existing company operates The Desk. Do not invent an entity or register a new company before checking this. |
| Now | Existing MIT declaration | `package.json` says MIT and `private: true`. There is no root licence text. Private npm metadata does not determine GitHub visibility or revoke licences. Audit origin, contributors, previous distributions and valid grants before deciding future licensing. This change leaves the declaration intact. |
| Now | Employment overlap | Privately review Search Property employment/contractor terms and any outside-business permission. Obtain an express exclusion for The Desk if needed. Do not put employment contracts or private commercial arrangements in a public repository. |
| Now | Trade mark clearance | Search exact/similar names and logos in Australia, including unregistered market use. Assess distinctiveness and service specifications for publishing, property information and software. Name availability and domain ownership are not clearance. An initial exact-phrase and broader register search is recorded in `trademark-preliminary-search.md`; comprehensive clearance and filing remain outstanding. |
| Now | Source permissions | Seven publisher-level policies have been read in `source-policy-reviews.json`; item-level permission remains unassessed. Check each underlying publisher for automated access, excerpt use, AI processing, storage and redistribution. Google discovery is not the publisher. Record terms URL, dated evidence, scope, restrictions, reviewer and next review trigger. |
| Before legal pages go live | Identity and processor review | Confirm operator, ABN where applicable, actual host/database suppliers and regions, provider retention/training settings, real mailbox monitoring and complaint process. The source code identifies integrations but does not prove production configuration. |
| Before licensing or sale | IP chain of title | Signed founder/contributor assignments, background IP schedule, open-source obligations, permitted moral-rights consents, and evidence of company control of domains/accounts. |
| Before paid/referral features | Commercial terms and advice scope | Review actual features and promotions, including credit, SMSF, financial-product and referral arrangements. No AFSL/credit authorisation is established by a disclaimer. Set pricing, cancellation and refund terms before selling. |
| Publishing operations | Sensitive claims and corrections | Define review ownership for serious allegations, court restrictions, privacy and contentious living-person claims. Existing evidence filters and documentary export review are not a general defamation review. Admin publishing controls, a feed review queue and a website story hold are now implemented. See `operations-runbook.md` for coverage limits, cached/external copies and incident handling. |
| Risk transfer | Insurance | Ask a broker about media liability, professional indemnity and cyber insurance that expressly accommodates AI-assisted publishing, copyright and defamation allegations. No insurance has been purchased. |

## Initial publisher-policy findings

The RBA, ABS, APRA and NSW website policies provide useful conditional reuse routes, with important exclusions. ABC and Guardian policy reviews need priority before assuming commercial reuse rights. See the seven dated primary-source records in `source-policy-reviews.json`. They do not grant permission. ABC and Guardian article extraction is now held pending review, including resolved publisher links and article-fetch redirects. An assessment of historical usage and any existing permissions is still required.

## Asset and data coverage limits

The inventory is not an exhaustive legal audit. Market-data adapters, fonts, narration models, synthetic music, generated artwork, historical exports, and transitive dependencies need separate assessment. Existing VIC, WA and QLD rental parsers contain some licence checks; those checks do not clear other datasets. A hash match proves identity, not copyright ownership or lawful context.

Keep original licence notices. Reuse CC material according to its actual licence and attribution requirements, and label alterations. Do not assume all government material is CC BY. Prefer zero-cost sources with express commercial-reuse permissions. If permission is missing, use an authorised alternative, a link-only format where appropriate, or hold the affected asset; do not bypass access restrictions.

## Deployment and verification

The two nullable columns appear in both `drizzle/0029_subscriber_consent_notice.sql` and the existing idempotent boot catch-up list. Do not run the uninitialised Drizzle migration journal against an existing production database; follow the application's established catch-up process. Check logs and both new columns after deployment. No destructive migration or historical consent backfill is required.

Use local or test-only mail credentials for tests. Do not bulk email existing subscribers as part of this change. For a real smoke test, use an address explicitly authorised for that purpose: request subscription, inspect notice, confirm, unsubscribe, request again, and verify suppression remains until reconfirmation. This task does not send a real email.

Read `owner-and-lawyer-brief.md` and `commercial-and-ownership-pack.md` for the decision pack, and `operations-runbook.md` for publishing/privacy controls and their limits. Regenerate `rights-register.json` when sources, assets or dependencies change. Preserve dated permission evidence in a private rights archive, not merely mutable links.

## Sources consulted

- [IP Australia: trade marks](https://www.ipaustralia.gov.au/trade-marks/what-are-trade-marks)
- [IP Australia: IP ownership](https://www.ipaustralia.gov.au/understanding-ip/who-owns-ip)
- [Australian Government: company structures](https://business.gov.au/planning/business-structures-and-types/business-structures/company)
- [Australian Government: copyright](https://business.gov.au/planning/protect-your-brand-idea-or-creation/copyright)
- [Attorney-General: copyright users](https://www.ag.gov.au/rights-and-protections/copyright/copyright-users)
- [OAIC: small business](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business)
- [ACMA: marketing messages](https://www.acma.gov.au/avoid-sending-spam)
- [ACCC: contracts](https://www.accc.gov.au/consumers/buying-products-and-services/contracts)
- [ASIC: discussing financial products online](https://www.asic.gov.au/regulatory-resources/financial-services/giving-financial-product-advice/discussing-financial-products-and-services-online)
- [Pexels: licence](https://www.pexels.com/license/)

These sources support the general framework. The Desk's actual obligations require assessment of its circumstances and operations.

## Additional operational safeguards

- Durable per-channel and all-publishing pauses with revision checks and audit events.
- Sensitive-story triage before new feed publication; held enrichment work waits for review, with 30-day input expiry.
- Admin website story holds, decision history and content-change checks.
- Frozen daily email batches recheck that their stories remain public.
- Privacy-request inventory and bounded cleanup of expired tokens and finished email payloads.
- Public complaint guidance without an unverified response-time guarantee.
- New schema is supplied by the established catch-up mechanism; verify all five new tables before deployment.
