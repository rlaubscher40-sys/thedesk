# Reader assurance follow-through · 18 September 2026

Base: PR319, `7bd2e68e2193d2b1a2e516e546944f02d2bb0771`.

## Remaining claims, not just corrected summaries

The live browser still showed unsupported talking points and reader angles on two stories whose summaries had already been corrected. Both originals were read in full for this follow-through:

- [Story 3960015 original](https://www.realestate.com.au/news/big-banks-hike-rates-days-from-rba-decision/): advertised fixed-rate moves and attributed forecasts do not establish an announced RBA decision or confirm an imminent hike. Replace the overconfident talking point and withdraw the three unsupported borrower/timing angles.
- [Story 3960030 original](https://www.realestate.com.au/news/homeowners-switch-to-interest-only-as-families-roll-debts-into-mortgages/): one broker's refinancing examples do not establish market-wide household stress, neighbours' equity losses, stock constraints or a price outcome. Replace the talking point with the sample limitation and withdraw those angles.

The existing summaries and earlier corrections remain. Public notices now cover the additional fields. Each startup correction requires the same exact story ID, source URL and prior field text, using binary comparison. Later edits are protected; nothing deletes the story, changes its publication date, or rewrites distributed email/social copies. Post-deployment observation is required to establish that the guards matched production.

## Keyboard flow and market labels

The signup panel removed the focused button on success, leaving keyboard focus on the document; its edit-address action did the same. Regression tests reproduced the missing focus handling before the change. The panel now focuses the confirmation, restores focus to the address on edit, and focuses invalid input on repeated attempts. It does not claim successful confirmation, send test emails, or autofocus a passive form on mount. Server failures remain linked inline errors. Mocked tests cover success and retry without accessing subscriber records.

Market at-a-glance and share-card text now distinguish one reporting reference from zero/multiple references. Counts, selection and coverage claims are unchanged.

## Verification boundary

Run type checking, focused tests, dead-code/legal audits and full isolated-MySQL CI before merging. Confirm the actual merged revision and Railway deployment, then inspect both stories, correction notices, a one-reference market page and client-side invalid signup in the live browser. Do not send real subscription requests for acceptance testing.

This closes specific defects; it does not certify all archive articles, real phones, account recovery, third-party rights, costs or future audience outcomes. Cloudflare work remains explicitly deferred. Previously blocked removal of published carousel slides is not retried. Existing source-review and outcome follow-ups remain separate evidence gathering, not a guaranteed future result.
