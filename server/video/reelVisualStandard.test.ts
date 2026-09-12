import { describe, expect, it, vi } from "vitest";
import { loadImage } from "@napi-rs/canvas";
import * as cards from "../og/instagramCards";
import {
  REEL_SHOTS,
  REEL_VISUAL_SEQUENCES,
  reelSceneShot,
  assertReelVisualSequence,
  reelCameraProgress,
} from "./reelVisualStandard";
import { loanPhotoCrop } from "./loanStoryPhotography";
import { cinematicEvidenceLayout } from "./cinematicEvidenceLayout";
import { splitMotion } from "./reelMotion";
import { verifiedInterstateMigration } from "../instagram/verifiedContextReels";
import { testMigration, contextNow } from "../instagram/fixtures/contextReels";
import { createEvidenceMotionRenderer } from "./evidenceMotionRenderer";
import type { EvidenceVisual, EvidenceRecipe } from "./evidenceVisual";

describe("mandatory repeatable full-screen visual standard", () => {
  it("covers every current recipe and rejects incomplete or unknown future sequences", () => {
    expect(Object.keys(REEL_VISUAL_SEQUENCES)).toHaveLength(8);
    for (const [recipe, sequence] of Object.entries(REEL_VISUAL_SEQUENCES)) {
      const kind = recipe as keyof typeof REEL_VISUAL_SEQUENCES;
      expect(() => assertReelVisualSequence(kind, Object.keys(sequence))).not.toThrow();
      expect(() => assertReelVisualSequence(kind, Object.keys(sequence).slice(1))).toThrow();
      expect(() => reelSceneShot(kind, "unreviewed-scene")).toThrow();
    }
    expect(() => assertReelVisualSequence("new-format" as EvidenceRecipe, ["label"])).toThrow();
    const sequence = REEL_VISUAL_SEQUENCES["interstate-migration"];
    const original = sequence.label;
    try {
      sequence.label = null;
      expect(() => assertReelVisualSequence("interstate-migration", Object.keys(sequence))).toThrow(
        "full-screen"
      );
    } finally {
      sequence.label = original!;
    }
  });
  it("ships credited assets that cover the canvas for the entire camera move", async () => {
    for (const shot of Object.values(REEL_SHOTS)) {
      const image = await loadImage((await cards.loadAsset(shot.asset))!);
      expect(shot.credit).toMatch(/illustration|archive/);
      for (const p of [0, 0.5, 1]) {
        const crop = loanPhotoCrop(image.width, image.height, shot.focus, p);
        expect(crop.x).toBeLessThanOrEqual(0);
        expect(crop.y).toBeLessThanOrEqual(0);
        expect(crop.x + crop.width).toBeGreaterThanOrEqual(1080);
        expect(crop.y + crop.height).toBeGreaterThanOrEqual(1920);
      }
    }
  });
  it("keeps each photographic composition legible within its actual rendered bounds", async () => {
    const template = verifiedInterstateMigration(testMigration(), contextNow)!.stat.visualStory!;
    for (const [recipe, sequence] of Object.entries(REEL_VISUAL_SEQUENCES)) {
      if (["housing-balance", "new-loan-rates"].includes(recipe)) continue;
      const v = {
        ...template,
        recipe,
        script: Object.keys(sequence).map((key) => ({ key, text: "Layout boundary rehearsal." })),
      } as EvidenceVisual;
      for (const key of Object.keys(sequence)) {
        const layout = cinematicEvidenceLayout(v, key, 1);
        if (!layout) continue;
        const { staticTree, layers } = splitMotion(layout.content);
        await cards.renderEditorialFrame(staticTree, "navy", layout.meta);
        for (const layer of layers)
          await cards.renderEditorialLayer(
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  position: "relative",
                  width: layer.width,
                  height: layer.height,
                },
                children: layer.node,
              },
            },
            layer.width,
            layer.height
          );
      }
    }
  }, 60000);
  it("fails before returning a renderer when an opening asset is absent", async () => {
    const v = verifiedInterstateMigration(testMigration(), contextNow)!.stat.visualStory!;
    const original = cards.loadAsset;
    const spy = vi
      .spyOn(cards, "loadAsset")
      .mockImplementation(async (name) =>
        name === REEL_SHOTS.moving.asset ? null : original(name)
      );
    const scenes = v.script.map((s, i) => ({
      key: s.key,
      start: i * 4,
      seconds: 4,
      phrases: [{ text: s.text, start: 0, seconds: 3 }],
    }));
    try {
      await expect(createEvidenceMotionRenderer(v, "navy", scenes, 24)).rejects.toThrow(
        "photograph is missing"
      );
    } finally {
      spy.mockRestore();
    }
  });
  it("continues adjacent shots and starts a fresh move when returning after a cut", () => {
    const scenes = Object.keys(REEL_VISUAL_SEQUENCES["new-loan-rates"]).map((key, i) => ({
      key,
      start: i * 4,
      seconds: 4,
    }));
    expect(reelCameraProgress("new-loan-rates", 8, 1, scenes)).toBe(
      reelCameraProgress("new-loan-rates", 8, 2, scenes)
    );
    const migration = Object.keys(REEL_VISUAL_SEQUENCES["interstate-migration"]).map((key, i) => ({
      key,
      start: i * 4,
      seconds: 4,
    }));
    expect(reelCameraProgress("interstate-migration", 20, 5, migration)).toBe(0);
  });
});
