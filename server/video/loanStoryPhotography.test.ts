import { describe, expect, it } from "vitest";
import { loadAsset } from "../og/instagramCards";
import { loadImage } from "@napi-rs/canvas";
import { LOAN_SHOTS, loanShot, loanCameraProgress, loanPhotoCrop } from "./loanStoryPhotography";

describe("full-screen borrowing story photography", () => {
  it("ships every reviewed shot and covers the portrait canvas throughout its pan", async () => {
    for (const shot of Object.values(LOAN_SHOTS)) {
      const bytes = await loadAsset(shot.asset);
      expect(bytes).toBeTruthy();
      const image = await loadImage(bytes!);
      for (const p of [0, 0.5, 1]) {
        const crop = loanPhotoCrop(image.width, image.height, shot.focus, p);
        expect(crop.x).toBeLessThanOrEqual(0);
        expect(crop.y).toBeLessThanOrEqual(0);
        expect(crop.x + crop.width).toBeGreaterThanOrEqual(1080);
        expect(crop.y + crop.height).toBeGreaterThanOrEqual(1920);
      }
    }
  });
  it("cuts from bank to money to home without resetting retained-scene motion", () => {
    const scenes = ["label", "value", "line", "claim", "facts", "signOff"].map((key, i) => ({
      key,
      start: i * 5,
      seconds: 5,
    }));
    expect(scenes.map((s) => loanShot(s.key))).toEqual([
      "bank",
      "money",
      "money",
      "home",
      "home",
      "home",
    ]);
    expect(() => loanShot("unreviewed")).toThrow();
    for (const [a, b, time] of [
      ["value", "line", 10],
      ["claim", "facts", 20],
      ["facts", "signOff", 25],
    ] as const) {
      expect(loanCameraProgress(a, time, scenes)).toBe(loanCameraProgress(b, time, scenes));
      expect(loanCameraProgress(b, time + 1 / 30, scenes)).toBeGreaterThan(
        loanCameraProgress(a, time, scenes)
      );
    }
  });
});
