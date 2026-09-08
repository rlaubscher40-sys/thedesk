import { describe, expect, it } from "vitest";
import { checkReelReadiness, parseFfmpegVersion } from "./preflight";

describe("parseFfmpegVersion", () => {
  it("pulls the version out of the paragraph of build flags around it", () => {
    expect(
      parseFfmpegVersion(
        "ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/  Copyright (c) 2000-2024"
      )
    ).toBe("7.0.2-static");
  });

  it("returns null rather than a guess when ffmpeg said something else", () => {
    expect(parseFfmpegVersion("command not found")).toBeNull();
  });
});

describe("checkReelReadiness", () => {
  it("runs the real binary and reports what it found", async () => {
    // Not a mock. The whole point of this check is that ffmpeg is there and
    // executable, which only running it can establish.
    const state = await checkReelReadiness();
    expect(state.ok).toBe(state.voice);
    expect(state.ffmpegVersion).toBeTruthy();
    if (process.env.CI === "true") expect(state.voice).toBe(true);
  });

  it("always explains itself in a sentence a human can act on", async () => {
    const state = await checkReelReadiness();
    expect(state.detail.length).toBeGreaterThan(10);
    // Whether narration is on is stated either way: a silent Reel renders and
    // posts perfectly, so nothing else would ever say so.
    expect(state.detail).toMatch(/[Nn]arration is (on|off)/);
  });
});
