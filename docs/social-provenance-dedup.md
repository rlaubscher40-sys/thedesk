# Source-attributed, non-repeating carousels

## Attribution is not independent verification

New weekly synthesis includes bounded `sourceItemIds` selected from the actual
feed IDs supplied to the writer. Unknown references and model-supplied source
metadata are discarded. The editor pass is asked to retain the references;
missing references remain missing, never matched by a guessed headline.

Weekly social preparation reloads the referenced feed rows, requires valid
source URLs and property relevance, and checks the dates against the edition
week and current Sydney day. It uses one original source headline and summary
per selected topic, with a fixed reading question. It does not publish the
generated synthesis headline as if bibliography links proved its claims.
Geography and statistical periods remain those stated in the original source
headline/summary; no separate city or reference period is inferred.

Slides and captions show the publisher and explicitly labelled *feed date*.
That date is when The Desk carried the article, not an invented publisher
publication date or statistical reference period. Captions retain the original
source URL and the numbered-edition destination. The caption size limit fails
visibly rather than truncating a source claim or URL. Source metadata does not
independently establish that the original publisher's claim is true.

Legacy editions remain available on the website. An edition without usable
references cannot automatically publish a weekly social carousel. Preview
uses the same source preparation but does not reserve publication or claim to
show the selected unpublished subset. Missing references are exposed as an
error rather than manufactured in a backfill.

## Durable duplicate prevention

Daily and weekly property carousels share permanent story identities derived
from canonical source URLs and normalized complete headlines. URL identity
removes common tracking parameters and fragments but retains content-selecting
queries. A changed feed ID, new date, tracking URL or syndicated identical
headline cannot reset the record. Reworded headlines at different URLs are not
semantic duplicates this release can reliably detect. Updated figures at a
new URL/new headline can qualify; an edited article at the same URL is held
conservatively rather than automatically declared a meaningful update.

Each daily date and weekly period has an exact publication-slot identity too.
The current `job_runs` table is reused under isolated `ig-news-` / `ig-slot-`
namespaces and a fixed logical identity date; no schema migration is required.
The slot and all selected story keys are inserted together in one transaction
immediately before Meta publication, after rendering and container preparation.
A concurrent claim, DB outage or duplicate key blocks the call. Preparation
failures before reservation can retry. After reservation, a failed/lost Meta
response or failed receipt write keeps the permanent lock. No expiry/release
or blind automatic reconciliation is added.

Successful receipts retain the exact media ID, headline and cover colour.
Retries recover that slot only; they no longer treat an arbitrary recent
Instagram post as their own. Colour survives late log recovery. The separately
requested manual Wider Lens and legacy stat/monthly formats are outside this
carousel change. Reel topic/month safeguards are unchanged.

These identities apply prospectively. Older carousel logs lack all slide/source
identities, so this release cannot claim a complete historical backfill or
retroactive duplicate prevention. It does not delete, edit or republish old
posts, or infer missing publication receipts from nearby timestamps.

## Checks

Offline tests cover source rehydration, stale/missing/future references, model
metadata rejection, source URL identity, cross-format duplicate suppression,
simultaneous claimants, DB failures, lost publish responses, exact receipt and
colour recovery, and the real publisher entrypoints with mocked Meta calls.
The SQL adapter test verifies one transactional bulk insert; it is not a live
database race test. Phone-width renders check source text. CI retains the full
three-format male narration/subtitle tests. Sydney schedule and free-service
constraints stay unchanged. Live account verification remains separate.
