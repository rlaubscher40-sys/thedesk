# Reel export records

Every newly generated automatic Reel captures the SHA-256 of its actual MP4 and
cover, duration, narration/subtitle flags, the local Kokoro voice options passed
to rendering, current layout boundaries, recipe and Railway build commit when
available. This records what was submitted; Instagram may re-encode the video.
It does not establish publication, visual quality or audience improvement.

The winner of the permanent Reel claim stores this alongside its existing
immutable companion-Story source before the Meta publish call. Source storage
remains best effort: failure cannot convert a successful Reel into a duplicate
retry. No schema migration, new scheduler, backfill or publication-lock rewrite
is required. Confirmed and uncertain publication receipt formats are unchanged.

The admin Reel panel joins export metadata to a confirmed receipt for the exact
publication key/reference period. Prepared or uncertain attempts cannot appear
as confirmed. Older missing records remain **not recorded**. Malformed records
and storage errors are **unavailable**; neither means permission to publish.
Historical coordinates are displayed as recorded, never replaced with today's
layout. This audit is read only and has no influence on selection or rotation.

After recording the normal successful publication receipt, runtime logs emit a
`reel-publication-render` entry with media ID, publication identity, export
metadata and whether durable source storage succeeded. Existing saved source
rows are never rewritten to claim a newer renderer was used. Build commit is
unknown outside Railway when its commit variable is absent or invalid.

Next acceptance: inspect this record after a normal scheduled Reel publishes,
then verify the separate companion Story receipt and existing audience snapshot.
The Story may be rendered after a deployment from the same saved evidence; the
Reel record describes only the submitted Reel, not a later Story's binary.
