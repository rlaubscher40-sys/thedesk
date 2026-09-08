import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifiedRentReel } from "../instagram/verifiedReel";
import { localSpeech, audibleWave, voiceModel } from "./localVoice";
import { renderStatReel } from "./statReel";

// CI installs the pinned voice before testing. Do not silently skip a missing
// deployment dependency there. Local checkouts can run logic tests without it.
const available = process.env.CI === "true" || existsSync(voiceModel());
describe.skipIf(!available)("real complete narrated Reel", () => {
  it("synthesises every passage and renders the full spoken comparison", async () => {
    const now = new Date("2026-09-08T10:00:00Z");
    const candidate = verifiedRentReel(
      {
        status: "available",
        retrievedAt: now.toISOString(),
        observations: [
          { city: "Brisbane", annualPercent: 4.6, period: "2026-07", status: "" },
          { city: "Perth", annualPercent: 5.3, period: "2026-07", status: "" },
        ],
      },
      now
    )!;
    const [first, duplicate] = await Promise.all(
      Array.from({ length: 4 }, () => localSpeech(candidate.script))
    );
    expect(first).toHaveLength(6);
    expect(duplicate).toEqual(first);
    expect(first.every((clip) => audibleWave(clip.bytes))).toBe(true);
    const video = await renderStatReel(candidate.stat, "light", {
      script: candidate.script,
      subtitles: true,
    });
    expect(video.narrated).toBe(true);
    expect(video.subtitled).toBe(true);
    expect(video.seconds).toBeGreaterThan(15);
    expect(video.seconds).toBeLessThanOrEqual(32);
    expect(video.bytes.length).toBeGreaterThan(100_000);
  }, 180_000);
});
