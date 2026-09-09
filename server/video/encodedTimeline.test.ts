import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { describe, expect, it } from "vitest";
import { buildVideoGraph } from "./statReel";
const run = promisify(execFile);

describe("encoded one-frame picture sequence", () => {
  it("retains individual reveals and the closing hold across hard cuts and dissolves", async () => {
    if (!ffmpeg) throw new Error("Required FFmpeg dependency missing");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-timeline-test-"));
    try {
      const still = path.join(dir, "pixel.ppm"),
        output = path.join(dir, "test.mp4");
      await fs.writeFile(still, "P3\n2 2\n255\n230 180 70 230 180 70 230 180 70 230 180 70\n");
      const beat = (seconds: number, fade = 0) => ({ seconds, fade, frame: { reveal: 1 } });
      const beats = [beat(1), ...Array.from({ length: 20 }, () => beat(1 / 30)), beat(1, 0.1)];
      const total = beats.reduce((n, b) => n + b.seconds - b.fade, 0);
      await run(
        ffmpeg,
        [
          "-y",
          "-v",
          "error",
          ...beats.flatMap(() => ["-i", still]),
          "-filter_complex_threads",
          "1",
          "-filter_complex",
          buildVideoGraph(beats, true),
          "-map",
          "[vout]",
          "-threads",
          "2",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-t",
          String(total),
          output,
        ],
        { timeout: 60000, maxBuffer: 1024 * 1024 }
      );
      const { stdout } = await run(
        ffmpeg,
        ["-v", "error", "-i", output, "-map", "0:v:0", "-f", "null", "-", "-progress", "pipe:1"],
        { timeout: 60000 }
      );
      const times = [...stdout.matchAll(/^out_time_us=(\d+)$/gm)];
      const actual = Number(times.at(-1)?.[1]) / 1_000_000;
      expect(actual).toBeCloseTo(total, 1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 90000);
});
