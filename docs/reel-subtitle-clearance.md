# Reel subtitle clearance

The subtitle line in a photographic Reel previously began almost immediately
below its photo credit. Independent subtitle positioning and a variable-height
three-line attribution block allowed the two reading tasks to crowd each other.

All editorial Reel frames now share `server/video/reelSafeAreas.ts` on the
1080 x 1920 canvas:

| Area                              | Vertical bounds                       |
| --------------------------------- | ------------------------------------- |
| Authored content and attribution  | End by 1420 px                        |
| Data source and photograph credit | Start at 1320 px, end by 1420 px      |
| Empty reading clearance           | At least 90 px before subtitle glyphs |
| Spoken subtitles                  | 1510 to 1640 px, centred at 1575 px   |
| Companion Story footer            | 1690 to 1760 px, centred at 1725 px   |

The source line retains the actual named dataset/method and reference context;
the repeated publisher line is omitted. Photograph credits remain visible.
Sources are readable editorial sans, not reduced to illegibly small type.
The subtitle face, 54 px documentary size, voice and measured timing stay intact.

The shared Satori renderer measures authored scene nodes and attribution and
refuses content below the boundary. Background photographs are exempt because
they intentionally fill the canvas. Both moving compositors check their layer
geometry before drawing. More than two subtitle lines is rejected. A regression
test renders actual two-line glyphs through the bundled font and production
libass encoder, then measures the pixels against the reserved area and both gaps.
Long credits and misplaced scene text must fail, not silently encroach on captions.

Every automatic recipe uses the editorial renderer. The companion Story uses
the same subtitled MP4 and a separately reserved footer. Keep these bounds shared;
do not repair individual formats by scattering new subtitle offsets through them.
New source copy or formats must fit the available space or receive editorial
layout changes before publication. Platform overlays still vary by surface.

Offline full voiced review across all eight recipes remains required for a shared
layout change, including the withheld rent-change recipe using a clearly labelled
internal fixture. Never force its eligibility or manually publish review exports.
