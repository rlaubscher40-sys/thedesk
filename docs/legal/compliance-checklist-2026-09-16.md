# The Desk: twenty-point implementation review

Reviewed 16 September 2026 against main at `84580ca`, following the legal foundations merged in PR #283. This records source-code evidence, fixes and unresolved decisions. It is not legal clearance, a WCAG conformance claim, proof of a monitored mailbox or an audit of every historical publication.

## Changes in this update

- One optional measurement choice on Privacy and Settings covers page views, product actions, signup attribution and performance observations. Browser Do Not Track and Global Privacy Control override it. Disabling measurement clears the local tracking session/arrival; observers recheck the preference before sending. Server analytics endpoints also honour `Sec-GPC`.
- Storage failures fail closed for optional measurement. Reader preferences no longer throw when persistent storage is unavailable. Essential security and requested-service operations continue.
- Replace the nonfunctional Delete account button with an accurately labelled email request. Access/correction/deletion contact guidance is also available without signing in. This is a human-handled process, not automatic erasure or proof that a case was completed.
- Feedback no longer remembers names on shared devices. Opening the form removes its old saved name. The form describes diagnostic collection and links to Privacy; an enquiry does not enrol someone in marketing.
- Unsubscribe responses, including errors, prohibit caching, indexing and referrer disclosure. Malformed multibyte signatures return rejection instead of throwing. Valid GET, one-click POST and legacy signatures remain supported; an email assistance link appears on the response page. Wording correctly refers to newsletters rather than promising no service email ever.
- Remove the global `/` character-only shortcut, which had no off/remap control. Search remains available through the visible search controls and Ctrl/Cmd+K. Existing focus containment, Escape and focus restoration tests remain in place.
- Retain readable OFL notices beside all six unmodified browser fonts. Check embedded copyright/version/licence metadata and record hashes in `web-fonts.json`. Add browser font and notice integrity checks to the existing rights audit, and run it in CI alongside existing reviewed-photo checks. It detects changed or unregistered fonts, not legal permission for every source.

## Checklist disposition

| # | Item | Evidence / disposition |
| --- | --- | --- |
| 1 | Privacy policy | `/privacy` covers actual collection, AI providers, overseas processing, storage, requests and choices. This update explains feedback, GPC and measurement controls. Operator, infrastructure settings/regions and legal applicability still need confirmation. |
| 2 | Terms | `/terms` already describes editorial/AI scope, third-party rights, corrections and non-excludable consumer rights. Legal operator remains outstanding; a disclaimer is not a licensing determination. |
| 3 | Refund policy | Current public subscription is free; no reader checkout was found. Do not create fictitious refund terms. Before payment is enabled, specify price, renewal, cancellation and remedies without overriding Australian Consumer Law. |
| 4 | Cookie policy | Actual cookie/browser storage explanation is within Privacy. A separate duplicate page is unnecessary. Infrastructure security cookies/settings still need provider-side verification. |
| 5 | Consent banner | No browser advertising SDK, third-party analytics script or tracking pixel found in the application shell. Measurement is first-party and now has a persistent off switch. This is not an EU/UK prior-consent implementation: assess jurisdiction/targeting and any future advertising SDK before claiming compliance or enabling tracking that requires prior consent. |
| 6 | Form consent | Existing double confirmation, versioned notice and transactional consent events retained. Feedback explicitly does not enrol readers. Legacy requests without a notice remain honestly unversioned. |
| 7 | Unnecessary data | New measurement opt-out covers attribution; feedback name persistence removed. Existing cleanup removes expired tokens and terminal delivery payloads. Raw page-view retention, consent evidence, feedback, provider logs and backup retention still require an approved schedule. No arbitrary mass deletion was performed. |
| 8 | Third-party SDKs | Browser bundle and server integrations reviewed. See processor inventory below. Direct dependency licence metadata refreshed by the audit; this is not exhaustive transitive licence clearance. |
| 9 | Deceptive design | Nonfunctional deletion button removed; privacy choice is a labelled native checkbox with clear save/failure feedback. Newsletter signup remains free and confirmed by email. |
| 10 | Hidden fees | No current public payment flow found. Before charging, review total pricing, renewal notices and cancellation journey. |
| 11 | Fake reviews | No invented reader testimonial/review widget found in the reviewed About/Subscribe acquisition surfaces. Demo data is explicitly demo-only and production cannot enter demo mode. Historical/manual social posts were not exhaustively reviewed. |
| 12 | Unsupported claims | Existing evidence validation, source dates, sensitive-story review and corrections controls remain. No promised investment result or verified legal compliance badge added. This is not factual clearance of every live or historical story. |
| 13 | Alternative text | Reviewed public image render sites: author portrait has a name; adjacent repeated portraits are decorative; story/edition imagery carries existing alternatives. Charts have existing textual context. Full assistive-technology review remains a separate conformance task. |
| 14 | Contrast | Existing light/dark palette and category contrast tests pass at 4.5:1 for checked core text backgrounds. New controls use those tokens. This does not certify every photograph, chart, overlay or third-party asset. |
| 15 | Keyboard navigation | Native privacy checkbox and links; existing modal focus/Escape tests pass. Removed unconfigurable character-only search shortcut; Ctrl/Cmd+K retained. |
| 16 | Business details | Ruben and the existing contact address are shown. **Blocked on verified operating entity and ABN/ACN, if applicable.** Do not invent a company or assume editorial contact equals legal operator. |
| 17 | Children's data | No child-oriented feature or age-specific collection identified in reviewed flows. No unnecessary date-of-birth collection added. Assess actual audience, applicable children's rules and parental authorisation before introducing child-targeted services. |
| 18 | Unsubscribe | Existing signed links, 90-day validity, one-click headers, immediate suppression and reconfirmation safeguards retained. Hardened error cases and private-response headers tested. No real subscriber email sent during this review. |
| 19 | Font/image licences | Six web fonts now have accompanying readable notices and verified hash records; 17 reviewed Reel photographs remain hash-checked. Current rights inventory regenerated. Publisher permissions, dataset-specific rights, narration-model/transitive obligations and historical exports remain unassessed where recorded. ABC/Guardian extraction holds stay in place. |
| 20 | Deletion requests | Public email instructions plus functional account-request link; admin inventory and case procedure already exist. Identity verification, justified retention/suppression, processor requests and backup handling remain human-operated. Nothing is falsely labelled deleted. |

## Processor and integration inventory

| Component | Information involved | Code evidence / remaining verification |
| --- | --- | --- |
| First-party analytics | Redacted paths, ephemeral session, hostname referrals, bounded events and campaigns | `client/src/lib/analytics.ts`, `attribution.ts`, `server/core/analyticsRoutes.ts`; now governed by one optional choice. Infrastructure still sees connection information. |
| Hosting / database / edge | Stored accounts, subscribers, enquiries, service records and connection/security data | Runtime MySQL connection, Railway deployment and Cloudflare context. Verify account owner, exact suppliers/regions, access lists, retention and backups privately. Do not infer these from a package name. |
| Resend | Recipient email/name, newsletter content and confirmation/delivery requests | `server/core/mailer.ts`; verify actual account retention, processing and operational mailbox delivery. |
| Anthropic | Submitted questions and selected editorial/source content | Ask notices and server LLM integration; verify provider account settings and contracts. Never claim no training/retention without evidence. |
| OpenAI | Production narration/image inputs when configured | `server/core/image.ts`, voice production; not an advertising SDK in the reader browser. Verify actual production settings. |
| Meta | Published media, captions, account/media IDs and insights | `server/instagram/api.ts`; server-side publishing, not browser pixel tracking. Existing publication controls remain. |
| Local voice/model/build tools | Model downloads and local rendering | Pinned setup checks remain; component licence distribution obligations still require their own review. |

## Owner decisions required to close remaining items

1. Confirm who legally operates The Desk and the applicable ABN/ACN, plus business contact details suitable for publication. The existing address is an editorial contact, not evidence of business registration.
2. Confirm ownership/employment/contributor rights and execute the prepared agreements where appropriate. Resolve future application licensing without purporting to revoke valid prior grants.
3. Confirm provider settings, processing regions, mailbox monitoring, incident responsibility and retention/backup policy. Complete a case-specific access/deletion request when one actually arrives; do not delete accounts or opt-outs as a demonstration.
4. Complete publisher/dataset/voice/transitive-rights assessments and trade mark clearance with appropriate expertise. Do not remove existing permission holds on the strength of this checklist.
5. Before new paid, referral, child-targeted or overseas-targeted services, reassess the actual feature and its applicable rules. Obtain professional review of the operator-specific privacy/terms/advice/media obligations.

The existing owner-and-lawyer brief, commercial/ownership pack and operations runbook contain the concrete preparation. No contract signed, filing submitted, insurance purchased, permission requested or message sent on the owner's behalf by this change.

## Verification

- Local full suite: 2,619 passed; 57 environment-dependent tests skipped. CI exercises the isolated database suites.
- TypeScript, dead-code checks, production client/server compilation and rights inventory passed locally.
- New regression coverage checks DNT/GPC/explicit opt-out, blocked storage, attribution suppression, observers after opt-out, accessible preference UI, feedback name minimisation, and real HTTP unsubscribe success/error behaviour.
- Live browser read verified the existing production Privacy page still shows the 14 September version. The remote browser cannot access the local preview (`ERR_BLOCKED_BY_CLIENT`); local Chromium installation also failed. New-page visual verification remains outstanding, although interactive component tests passed.
- The owner explicitly authorised pushing, merging and deploying this update to `rlaubscher40-sys/thedesk` on 16 September 2026. Branch `fix/compliance-followthrough` was rebased onto `de7226c`, preserving the separately verified recovery exercise.
- Release gate: CI/security including isolated database tests and rights inventory, merge against the reviewed head only after checks pass, then verify deployed Privacy/Settings controls and unsubscribe headers. The PR records final release evidence; local tests alone are not deployment verification.

## Primary references checked

- [OAIC small business applicability](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business)
- [ACMA commercial messages and unsubscribe](https://www.acma.gov.au/avoid-sending-spam)
- [W3C character-only keyboard shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)
- Font notice sources and exact embedded metadata are recorded in `web-fonts.json` and `client/public/fonts/README.txt`.
