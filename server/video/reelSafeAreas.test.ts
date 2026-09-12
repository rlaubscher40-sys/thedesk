import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  renderEditorialFrame,
  renderEditorialLayer,
  loadReelSubtitleFont,
} from "../og/instagramCards";
import { subtitleAss } from "./subtitles";
import {
  REEL_SAFE_AREAS as safe,
  assertReelContentBottom,
  assertReelSceneBottom,
} from "./reelSafeAreas";

describe("reserved subtitle area across Reel recipes", () => {
  it("measures visible moving text independently of transparent stamp padding", async () => {
    let bottom = 0;
    await renderEditorialLayer(
      {
        type: "div",
        props: {
          style: { display: "flex", width: 840, height: 400 },
          children: {
            type: "div",
            props: {
              style: {
                display: "flex",
                position: "absolute",
                top: 20,
                fontFamily: "Desk Editorial Sans",
                fontSize: 30,
              },
              children: "A moving figure",
            },
          },
        },
      },
      840,
      400,
      (value) => {
        bottom = Math.max(bottom, value);
      }
    );
    expect(bottom).toBeGreaterThan(30);
    expect(bottom).toBeLessThan(100);
    expect(() => assertReelContentBottom(1300 + bottom)).not.toThrow();
    expect(() => assertReelContentBottom(1400 + bottom)).toThrow("subtitle clearance");
  });
  it("refuses content, credits and moving layers entering the reading clearance", async () => {
    const meta = {
      kicker: "TEST",
      source: "ABS / reviewed source",
      index: 0,
      count: 1,
      quiet: true,
    };
    const content = {
      type: "div",
      props: {
        style: { display: "flex", position: "absolute", top: 1070, fontSize: 30 },
        children: "Too low",
      },
    };
    await expect(renderEditorialFrame(content, "navy", meta)).rejects.toThrow("clearance");
    await expect(
      renderEditorialFrame(
        { type: "div", props: { style: { display: "flex" }, children: "Story" } },
        "navy",
        { ...meta, photoCredit: "An excessively long unreviewed credit ".repeat(25) }
      )
    ).rejects.toThrow("subtitle clearance");
    expect(() => assertReelContentBottom(1421)).toThrow("subtitle clearance");
    expect(() =>
      subtitleAss([{ start: 0, end: 1, lines: ["one", "two", "three"] }], "documentary")
    ).toThrow("two-line");
  });
  it("reserves a separate source gap without rejecting transparent layout padding", async () => {
    const meta = { kicker: "TEST", source: "NHSAC 2026 / p. 21", index: 0, count: 1, quiet: true };
    const note = (top: number, painted = false) => ({
      type: "div",
      props: {
        style: { display: "flex", width: 840, height: 980, position: "relative" },
        children: {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              top,
              fontSize: 24,
              ...(painted ? { width: 600, height: 20, backgroundColor: "#fff" } : {}),
            },
            children: painted ? "" : "NET OF DEMOLITIONS / SAME 18 MONTHS",
          },
        },
      },
    });
    await expect(renderEditorialFrame(note(880), "navy", meta)).resolves.toBeInstanceOf(Buffer);
    // The old housing note cleared subtitles, but ran directly into its source.
    await expect(renderEditorialFrame(note(949), "navy", meta)).rejects.toThrow("source clearance");
    await expect(renderEditorialFrame(note(949, true), "navy", meta)).rejects.toThrow(
      "source clearance"
    );
    expect(safe.attributionTop - safe.sceneBottom).toBeGreaterThanOrEqual(40);
    expect(() => assertReelSceneBottom(1281)).toThrow("source clearance");
  });
  it("keeps actual libass two-line glyphs inside the reserved area with clearance on both sides", async () => {
    if (!ffmpeg) throw new Error("Required encoder missing");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-caption-clearance-"));
    try {
      await fs.writeFile(path.join(dir, "font.ttf"), await loadReelSubtitleFont(true));
      await fs.writeFile(
        path.join(dir, "caption.ass"),
        subtitleAss(
          [
            {
              start: 0,
              end: 1,
              lines: ["A city total can't tell you when", "homes near you will be ready."],
            },
          ],
          "documentary"
        )
      );
      await promisify(execFile)(
        ffmpeg,
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=black:s=1080x1920:d=1",
          "-vf",
          "ass=caption.ass:fontsdir=.",
          "-frames:v",
          "1",
          "caption.png",
        ],
        { cwd: dir, timeout: 30000 }
      );
      const { data, info } = await sharp(path.join(dir, "caption.png"))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let top = 1920,
        bottom = 0;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * info.channels;
          if (data[i]! > 100 && data[i + 1]! > 100 && data[i + 2]! > 100) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      expect(bottom).toBeGreaterThan(top);
      expect(top).toBeGreaterThanOrEqual(safe.subtitleTop);
      expect(bottom).toBeLessThanOrEqual(safe.subtitleBottom);
      expect(top - safe.attributionBottom).toBeGreaterThanOrEqual(90);
      expect(safe.storyFooterTop - bottom).toBeGreaterThanOrEqual(50);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
