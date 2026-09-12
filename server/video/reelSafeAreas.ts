/** Shared portrait layout contract, in pixels on the 1080 x 1920 canvas.
 * Keep a genuine reading pause between attribution and spoken captions. */
export const REEL_SAFE_AREAS = {
  sceneBottom: 1280,
  contentBottom: 1420,
  attributionTop: 1320,
  attributionBottom: 1420,
  subtitleTop: 1510,
  subtitleCentreY: 1575,
  subtitleBottom: 1640,
  storyFooterTop: 1690,
  storyFooterCentreY: 1725,
  storyFooterBottom: 1760,
} as const;

/** Scene notes must clear the attribution, as well as the spoken subtitles. */
export function assertReelSceneBottom(bottom: number, element = "scene element") {
  if (!Number.isFinite(bottom) || bottom > REEL_SAFE_AREAS.sceneBottom + 0.5)
    throw new Error(
      `Reel scene enters source clearance: ${element.slice(0, 100)} ends at ${bottom.toFixed(1)}px. Review before publishing.`
    );
}

export function assertReelContentBottom(bottom: number) {
  if (!Number.isFinite(bottom) || bottom > REEL_SAFE_AREAS.contentBottom + 0.5)
    throw new Error("Reel content enters subtitle clearance. Review the scene before publishing.");
}
