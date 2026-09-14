import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REEL_SHOTS } from "./reelVisualStandard";
import { assertReviewedPhotoBytes } from "./assetRights";

describe("bundled Reel rights records", () => {
  it("binds every current photograph to its recorded individual source and bytes", () => {
    for (const shot of Object.values(REEL_SHOTS)) {
      const bytes = readFileSync(new URL(`../og/fonts/${shot.asset}`, import.meta.url));
      expect(() => assertReviewedPhotoBytes(shot, bytes)).not.toThrow();
    }
  });
  it("rejects changed bytes and search pages even when metadata looks reviewed", () => {
    const shot = REEL_SHOTS.residential;
    expect(() => assertReviewedPhotoBytes(shot, Buffer.from("changed"))).toThrow("changed");
    expect(() =>
      assertReviewedPhotoBytes(
        { ...shot, source: "https://unsplash.com/s/photos/houses" },
        Buffer.from("changed")
      )
    ).toThrow("Individual rights evidence");
  });
  it("requires raw bytes or an image data URL, not a remote address", () => {
    const bytes = Buffer.from("fixture");
    const shot = { ...REEL_SHOTS.bank, sha256: createHash("sha256").update(bytes).digest("hex") };
    expect(() =>
      assertReviewedPhotoBytes(shot, `data:image/jpeg;base64,${bytes.toString("base64")}`)
    ).not.toThrow();
    expect(() => assertReviewedPhotoBytes(shot, "https://example.com/image.jpg")).toThrow(
      "Image bytes required"
    );
  });
});
