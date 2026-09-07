import { describe, expect, it } from "vitest";
import { buildFilterGraph, REEL_HEIGHT, REEL_SECONDS, REEL_WIDTH } from "./statReel";

describe("buildFilterGraph", () => {
  it("gives zoompan a per-beat frame count, never a looped stream", () => {
    // zoompan emits `d` frames for EVERY frame it is given. Feeding it a
    // stream multiplies frames catastrophically — the first version of this
    // produced a 118MB file in four and a half minutes for a ten second clip.
    const graph = buildFilterGraph([{ reveal: 0, seconds: 2 }]);
    expect(graph).toContain("d=60"); // 2s at 30fps
    expect(graph).not.toContain("loop");
  });

  it("scales every beat to the Reel frame", () => {
    const graph = buildFilterGraph([{ reveal: 0, seconds: 1 }]);
    expect(graph).toContain(`s=${REEL_WIDTH}x${REEL_HEIGHT}`);
  });

  it("concatenates exactly the beats it was given", () => {
    const graph = buildFilterGraph([
      { reveal: 0, seconds: 1 },
      { reveal: 0.5, seconds: 1 },
      { reveal: 1, seconds: 1 },
    ]);
    expect(graph).toContain("concat=n=3");
    expect(graph).toContain("[v0][v1][v2]concat");
  });

  it("sets square pixels, so the frame is not stretched on playback", () => {
    expect(buildFilterGraph([{ reveal: 0, seconds: 1 }])).toContain("setsar=1");
  });

  it("never emits a zero-frame beat", () => {
    // A beat rounded to nothing would make ffmpeg reject the whole graph.
    expect(buildFilterGraph([{ reveal: 0, seconds: 0.001 }])).toContain("d=1");
  });
});

describe("clip length", () => {
  it("stays in the range a Reel is watched at", () => {
    // Long enough to read the claim, short enough to loop rather than be
    // scrolled past.
    expect(REEL_SECONDS).toBeGreaterThan(6);
    expect(REEL_SECONDS).toBeLessThan(20);
  });
});
