import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { REEL_PHOTO_CATALOGUE } from "./reelPhotoCatalogue";
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
  it("assigns varied reviewed story beats without random or runtime photo selection", () => {
    const openings = new Set<string>();
    for (const sequence of Object.values(REEL_VISUAL_SEQUENCES)) {
      openings.add(sequence.label!);
      expect(new Set(Object.values(sequence).filter(Boolean)).size).toBeGreaterThanOrEqual(2);
    }
    expect(openings.size).toBe(7);
    expect(REEL_VISUAL_SEQUENCES["approval-comparison"]).toMatchObject({
      construction: "building",
      completion: "residential",
    });
    expect(REEL_VISUAL_SEQUENCES["new-loan-rates"]).toMatchObject({
      label: "bank",
      value: "money",
      claim: "home",
      signOff: "residential",
    });
  });
  it("binds each new curated image to its reviewed bytes and free-source provenance", async () => {
    for (const shot of Object.values(REEL_PHOTO_CATALOGUE)) {
      const dataUrl = await cards.loadAsset(shot.asset);
      expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      const bytes = Buffer.from(dataUrl!.split(",")[1]!, "base64");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(shot.sha256);
      expect(shot.source).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\//);
      expect(shot.licence).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\/license\/?$/);
      expect(shot.purpose).toContain("not");
      expect(shot.reviewed).toBe("2026-09-12");
    }
  });
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
        const crop = loanPhotoCrop(
          image.width,
          image.height,
          shot.focus,
          p,
          "zoom" in shot ? shot : {}
        );
        expect(crop.width / crop.height).toBeCloseTo(image.width / image.height, 10);
        expect(crop.x).toBeLessThanOrEqual(0);
        expect(crop.y).toBeLessThanOrEqual(0);
        expect(crop.x + crop.width).toBeGreaterThanOrEqual(1080);
        expect(crop.y + crop.height).toBeGreaterThanOrEqual(1920);
      }
    }
  });
  it("keeps the reviewed residential roofline in the clear image area rather than behind the headline", async () => {
    const shot = REEL_PHOTO_CATALOGUE.residential;
    const image = await loadImage((await cards.loadAsset(shot.asset))!);
    // Reviewed central roofline lies about 44% down the unchanged source image.
    for (const p of [0, 0.35, 0.5, 1]) {
      const crop = loanPhotoCrop(image.width, image.height, shot.focus, p, shot);
      const roofY = crop.y + 0.44 * crop.height;
      expect(roofY).toBeGreaterThan(250);
      expect(roofY).toBeLessThan(700);
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
  it.each(["moving", "building", "residential", "neighbourhood"] as const)(
    "fails when required %s photography is absent",
    async (shot) => {
      const v = verifiedInterstateMigration(testMigration(), contextNow)!.stat.visualStory!;
      const original = cards.loadAsset;
      const spy = vi
        .spyOn(cards, "loadAsset")
        .mockImplementation(async (name) =>
          name === REEL_SHOTS[shot].asset ? null : original(name)
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
    }
  );
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
