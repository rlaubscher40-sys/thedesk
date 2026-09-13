# Weekly briefing design and Story sequence

The weekly renderer now uses a concise source headline, a complete sentence of
reported context, and a credited bundled illustration. It removes the Before
You Act box, repeated lead labels, and feed-date metadata from the cover.
Topic slides show intact source detail in readable sans-serif type. Where
applicable, a separate Context section explains the housing measure using the
existing editorial definitions. Generic advice and generated investment
implications never become the payload. Unsupported context is omitted.

The full source title, publisher, original publication timing and source URL
remain in the caption. Captions include reported lead detail when it fits and
one save invitation. Whole optional detail can be omitted to fit 2,200
characters; source attribution and claims are never clipped. Missing usable
source detail holds the carousel before Meta uploads. Existing freshness,
property relevance and permanent publication locks remain in force.

New weekly carousels automatically enrol three separately rendered 9:16 Stories:
1. Cover and source context.
2. Lead story detail.
3. Other selected headlines and an invitation to read the carousel on the profile.

These are standalone Story images, not Instagram's native tappable post-share
sticker or a swipeable carousel embedded in a Story. The CTA says what the viewer
can actually do. The publishing system does not claim a clickable sticker.
Each frame waits 45 seconds, owns a distinct permanent receipt, and stops the
remaining sequence on any uncertainty. Frame-specific receipt keys preserve
compatibility with existing daily Story keys. A Story error never republishes
or fails an already live carousel. Old posts and recovered slots are not
backfilled. Story rendering errors are recorded and do not prevent the feed
carousel. Background delivery can be interrupted by a process restart; this
change does not introduce a persistent recovery worker or replay uncertain calls.

Offline visual review:
`node --import tsx scripts/weeklyBriefingPreview.ts /tmp/weekly-review`

The preview contains clearly labelled fictional layout fixtures and makes no
publishing call. Admin preview `weekly-story?i=0`, `i=1`, `i=2` exposes the same
three renderers, with the existing authenticated edition selector. Text bounds
are measured during rendering; an oversized claim is held rather than hidden.
Use actual same-age reach, saves and shares to evaluate results after publication;
this redesign does not establish an engagement improvement by itself.
