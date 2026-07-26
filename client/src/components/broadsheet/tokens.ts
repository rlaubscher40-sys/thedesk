/**
 * Broadsheet layout constants.
 *
 * The redesign's structural rule is that every rule and grid spans
 * gutter-to-gutter: 56px on desktop, 20px on mobile. Rather than repeat
 * `px-5 lg:px-14` in thirty places (and inevitably drift), the gutter is
 * named once here and imported.
 *
 * `GUTTER` is for full-bleed bands that own their own padding (the
 * utility bar, the masthead). `GUTTER_X` is the same inset expressed as a
 * margin, for blocks that need their *border* to stop at the gutter
 * rather than run under it.
 */
export const GUTTER = "px-5 lg:px-14";
export const GUTTER_X = "mx-5 lg:mx-14";
