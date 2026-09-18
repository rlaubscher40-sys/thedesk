# Assistant-controlled quality follow-through · 18 September 2026

The requested audit now assesses work the assistant can perform: source-faithful content, accessible reader journeys, useful retrieval, honest product states, publishing safeguards and verified engineering changes. Owner account setup, deferred provider work and other owner actions are excluded from this score. This is a change in audit scope, not evidence that those actions occurred.

## Defects addressed

- The live Australian archive advertised 1,188 stories, including 374 Property stories, but category browsing stopped at 100. It now uses 40-story pages with a date/ID cursor. Filters apply before the page limit; newly collected stories do not displace or repeat older pages. Filter changes reset the cursor, pagination moves keyboard focus to the results, and publisher labels distinguish syndicated records.
- Search used to pick the newest 50 matches before ranking them. It now ranks the full matching set in SQL before applying the bounded response, so older exact titles outrank newer body-only mentions. A sentinel row exposes whether more matches exist. The interface states the cap and offers refinement; it does not claim that 50 is the corpus total.
- Missing archive/search storage now reports an error instead of a fictitious empty collection. Local-market searches use Australian coverage, expose request failures with retry, and link to the archive when additional results exist. The watchlist's in-memory and persisted maximum both remain 12.
- Weekly editorial review could move a valid source ID from one topic to another because the runtime guard checked the union of all references. The guard now requires each topic's original category and source-ID set in its original position. Unexpected attribution changes fail before edition insertion. This validates attribution identity, not the truth of arbitrary generated prose.
- A shared stored talking point was labelled with the current reader's persona even though the text did not change. The label now accurately describes the shared line. Small-screen archive rows stack metadata above the title, freeing the headline width.

## Verification

Focused regression tests cover cursor validation and page boundaries, preserving filters, focus, count/cap labels, source visibility, request failures and retry, watchlist limits, generic-line labelling, and topic-specific attribution.

The isolated MySQL regression checks ranking before the cap and searches with literal percent characters. It verifies Australian coverage and exclusion of withheld records, all-record traversal and a new insertion between pages. It requires the existing local CI test database and creates only a connection-local temporary table.

Local TypeScript, dead-code and rights-inventory integrity checks passed. Full CI with the isolated database, production build and security gates is required before merge. Live acceptance must verify navigation beyond the former 100-row ceiling, publisher labels, capped-search disclosure and the shared talking-point label on the exact deployed revision. Release identifiers and acceptance observations belong in the PR and the dated audit report once observed.

This pass makes no claim of exhaustive historical editorial verification or physical-phone testing. It changes no subscriber records, documentary exports, publication schedules or owner account settings.
