# Publishing, complaints and privacy operations

Prepared 14 September 2026. Implementation instructions and proposed operating procedures. No incident, complaint, deletion request or professional engagement has been assumed.

## Responsibility

Ruben Laubscher confirmed on 17 September 2026 that he owns and operates The Desk. Ruben is the responsible operator and editorial/incident contact. This owner declaration resolves the outstanding operating-identity question; it is not evidence of a particular company registration, ABN, third-party content rights or provider account security. Confirm monitored contact delivery and a deputy if one is appointed. Keep real case records, employment agreements and credentials in a restricted business workspace, never in this repository. Use an incident reference in admin notes instead of personal details or privileged advice.

## Emergency publishing pause

In Admin → Settings or Stories → Publishing controls, enter a reason and pause All publishing. Individual controls cover new website feed/edition inserts, editorial emails, and Instagram writes including containers, Reels, Stories and first comments. Subscription confirmations and admin alerts continue. All publishing overrides the individual controls. State and an editor-attributed event are saved in one transaction. Stale admin updates are rejected. A production database failure stops publishing at the guarded boundary; there is no permissive in-memory production fallback.

These checks do not retract existing pages or provider-accepted requests. They do not control manually posted content, separate external automation, or unaudited third-party integrations. A pause cannot cancel a request already in flight. Review these separately before resuming. The website stays readable during a pause; maintenance/correction edits are still possible.

## Complaint and takedown procedure

1. Record the report time, URL/post ID, type of concern, evidence, requested action, contact method and responsible editor in a restricted case file. Acknowledge receipt without admitting facts that have not been investigated. The website no longer promises an unverified same-day response.
2. Assess urgency. Court restrictions, exposure of private information, credible safety risks and serious allegations need prompt attention. Seek appropriate legal help when the issue requires it.
3. Pause All publishing if a disputed item could spread. For a feed story, use Hold an existing website story and its numeric ID. This changes its channel to the existing private HOLD lane, preserves evidence/identity and records the action. Local read caches are invalidated. Other replicas, client caches, generated cards and external caches can retain prior copies until invalidated/expired. Inspect them, do not promise instant removal everywhere.
4. Find every derivative: website page and Ask/share links, frozen email batches, carousel receipts and story IDs, Reel plans/exports, Stories, comments, newsletters and manually posted copies. Pause relevant external schedulers. Keep an evidence copy privately where lawful. Do not casually delete records needed for an active dispute.
5. Correct or remove each affected copy. An email accepted by the provider cannot be recalled; decide whether a correction email is appropriate. Frozen daily briefs now recheck that all source stories remain public before each recipient. Other frozen outputs still require editor review before resumption.
6. Record findings and the decision. Material corrections should identify the original error, corrected fact and date on the corrections log. Avoid repeating restricted allegations or identifying details in the public log.
7. Verify anonymous website reads, relevant caches and each platform. Resume only after reviewing queued work. Record the reason. An uncertain social publication keeps its durable claim; never clear claims blindly to retry.

## Sensitive-story review

New feed insertions scan title, summary and available source text for a bounded set of serious-allegation, criminal-proceeding, protected-identity and explicit sponsorship phrases. Matches are stored in HOLD with reasons and a content hash. They are excluded from normal public feed selection. Enrichment jobs remain `legal-held`, so the full text is not sent to the enrichment model while awaiting review. The source may already have been read during editorial assessment.

Admin reviewers must read the original source and assess evidence, attribution, currency, response/context, court restrictions, privacy and commercial disclosures. Approval is not a legal opinion. It restores the original channel and releases a pending enrichment job; rejection retains HOLD and discards the enrichment input. Decisions are logged. Changed text cannot be approved against an old hash. Unreviewed source inputs expire after 30 days, and an expired item needs fresh source preparation. The review screen shows up to 100 pending items.

This is a triage rule, not a defamation detector. It can miss cases and can flag innocent context. It does not retrospectively classify the archive, screen arbitrary edition prose, or certify documentaries. Apply the same editorial procedure to those outputs. A report of a criminal charge must not be rewritten as guilt. Routine unflagged stories remain automatic.

## Rights and free-source procedure

ABC and Guardian article extraction is now held pending a documented permission or exception assessment. The check covers resolved publisher URLs and article-fetch redirects. Discovery links are not licences, and a mirror is not an alternative permission. Existing published material is not retrospectively cleared or removed by this code.

Use original aggregate releases for the underlying facts where appropriate: ABS for population/construction/rents indicators, RBA for monetary policy, APRA for banking statistics, Treasury for housing policy, and the relevant state/council's original release. These sources do not replace every independent news story. Apply each actual licence, attribution and third-party exclusion; do not declare every government domain approved. No paid source was added.

For each proposed use, record the exact work, creator, licence URL/date, permission evidence, collection/AI/adaptation/distribution scope, attribution, changes, restrictions and output IDs. Store written permissions privately. Remove a coded hold only after a review covering the intended use. Regenerate `rights-register.json` after source or asset changes. Unlisted sources remain unassessed, not approved.

## Privacy requests and retention

The admin privacy inventory accepts one email address and locates the subscriber, up to 100 recent consent events, and counts of matching feedback, accounts and delivery records. It never returns tokens or frozen email bodies. This is internal case preparation, not a complete personal-data export or an automated deletion decision.

1. Verify the requester using a proportionate method before disclosure or deletion. Do not ask for identity documents by default. Record the verification outcome rather than retaining unnecessary evidence.
2. Identify relevant data in the inventory plus feedback text, linked account/reading-queue records, shared questions, server/provider logs, mail delivery records, backups and any separately held correspondence. Do not infer that no email match means no personal information exists.
3. Decide what can be supplied, corrected, deleted or retained. Check third-party privacy, legal holds and applicable retention duties. Distinguish a marketing unsubscribe from a full deletion request.
4. For deletion, prepare a case-specific plan covering live database rows, pending delivery payloads, processors and backup expiry. Retain only justified minimum suppression/evidence records. Simply deleting a subscriber row can lose their opt-out history. No bulk subscriber deletion endpoint is provided.
5. Verify completion and describe any justified retained data and backup limitations to the requester. Ensure a restore does not reactivate opt-outs or reintroduce deleted live data.

Automatic hourly housekeeping removes expired confirmation tokens with a known issue timestamp, residual email payloads already in terminal delivery states, and 30-day-old held enrichment inputs. It does not delete subscribers, opt-outs, consent events or incident evidence. Legacy tokens without an issue time are not assigned an invented expiry. Terminal email payloads ordinarily clear immediately in the delivery workflow; housekeeping is an additional safeguard.

Consent events start at deployment: requested, confirmed and unsubscribed, with subscriber ID, notice version where known, source and timestamps. No token, email body or IP address is added to this history. Changes and events commit together under row locks. Application code appends events; a database administrator could still alter them. The retention period for consent history, feedback and provider backups must be set against actual business/legal needs rather than inventing a universal deadline.

## Data incident procedure

Contain exposure and preserve necessary evidence; identify affected data and people; assess consequences and available remediation; determine applicable reporting duties with counsel; communicate through verified channels; document recovery and prevention. Assign an incident lead and a communications owner. Rotate compromised credentials through the provider's secure process, revoke affected sessions and check access logs.

If the Notifiable Data Breaches scheme applies, suspected eligible breaches require prompt assessment, taking all reasonable steps to finish within 30 calendar days. Where an eligible breach is established, notification is required as soon as practicable unless an exception applies. The 30-day assessment period is not permission to delay an already-required notification. Applicability and other duties still need assessment. [OAIC guidance](https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches).

## Deployment checks

Use the established boot catch-up migrations. New tables: publication_controls, publication_control_events, legal_story_reviews, legal_review_events and subscriber_consent_events. No existing publishing pause is activated by the migration. Confirm the tables before enabling schedulers; missing tables will stop guarded operations. Apply tests on an isolated database and check logs for migration or cleanup failures. Do not run an uninitialised migration journal against production.

Before deploying public legal pages, resolve legal identity and actual processor settings. Before resuming after an incident, inspect queued and external copies. Before paid/referral features, complete the commercial review described in `commercial-and-ownership-pack.md`.
