# Shared Signal evidence

New Number and Chart exports save immutable evidence before returning a share
link. Previously the card carried a date while its URL selected the latest
metric and latest chart history. A removed metric could even select a different
headline signal. A shared card and its destination could therefore disagree.

The saved record contains the metric's value, unit, source, source URL, reporting
date, last storage date, previous value, selected history, movement copy and any
attached editorial take/edition. A SHA-256 content identifier deduplicates equal
snapshots; changed evidence gets another identifier. Duplicate inserts never
overwrite content or the original storage time. Retrieval validates the stored
shape and content hash. Dates round-trip through database JSON explicitly.

The public sharing endpoints accept a metric key and an optional existing
snapshot ID, never user-supplied evidence. Existing render quotas still apply.
New snapshots are written only during an explicit successful card export.
Storage failure prevents a purported permanent share link from being returned.
The startup schema catch-up creates the additive `signal_snapshots` table.
Snapshots have no automatic expiry; their availability depends on retaining the
database. Chart histories are bounded to 1,000 points per share.

The Signals hero, re-share buttons, Number/Chart toggle, public HTML metadata
and preview images use the same saved evidence. A saved editorial take does not
change to today's edition. Freshness explanations are recalculated using the
original dates. The separate latest board remains available and labelled.
Historical values are not used as a new watch's current baseline.

Malformed, missing or mismatched snapshots show an evidence gap without a live
fallback. Retrieval failures are distinguished from absence. Preview metadata
for unavailable evidence is neutral and non-indexable; its image falls back to
the brand card, never another metric. Missing key-only requests also stop
substituting a different headline metric.

Older URLs without a snapshot remain latest-record links: they did not retain
enough information to reconstruct the original share. This change does not
retrofit old posts, archive every publisher revision, or change automated social
posting. It preserves the server-selected evidence used for each new manual
Signal card share; it does not independently verify the publisher's figures.

Regression coverage includes all three export endpoints, re-sharing after live
data changes/disappears, quota and failure handling, saved page rendering, HTML
and image previews, and an isolated MySQL test for JSON roundtrips, duplicates,
distinct revisions and corrupt-content rejection. Release and live verification
evidence are recorded in the PR.
