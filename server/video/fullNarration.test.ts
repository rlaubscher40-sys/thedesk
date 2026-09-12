import { existsSync, readFileSync } from "node:fs";
import { parseAbsApprovals } from "../markets/absApprovals";
import { verifiedSupplyReel } from "../instagram/verifiedSupplyReel";
import { describe, expect, it } from "vitest";
import { verifiedRentReel } from "../instagram/verifiedReel";
import { verifiedCapitalRentReel } from "../instagram/verifiedCapitalRentReel";
import {
  verifiedSydneyBeforeBuy,
  verifiedSydneyRentChange,
} from "../instagram/verifiedSydneyReels";
import { RENT_CITIES } from "../../shared/cityRents";
import { localSpeech, audibleWave, voiceModel } from "./localVoice";
import { renderStatReel } from "./statReel";
import { renderReelStory } from "./reelStory";

// CI installs the pinned voice before testing. Do not silently skip a missing
// deployment dependency there. Local checkouts can run logic tests without it.
const available = process.env.CI === "true" || existsSync(voiceModel());
describe.skipIf(!available)("real complete narrated Reel", () => {
  it.each(["change", "checklist"])(
    "renders the automatic Sydney %s story with narration and subtitles",
    async (kind) => {
      const now = new Date("2026-09-09T08:30:00Z");
      // Synthetic fixtures, not current market claims.
      const candidate =
        kind === "change"
          ? verifiedSydneyRentChange(
              {
                status: "available",
                retrievedAt: now.toISOString(),
                observations: [
                  { city: "Sydney", period: "2026-07", annualPercent: 3.5, status: "" },
                  { city: "Sydney", period: "2026-06", annualPercent: 3.8, status: "" },
                ],
              },
              now
            )
          : verifiedSydneyBeforeBuy(
              {
                status: "available",
                retrievedAt: now.toISOString(),
                observations: Array.from({ length: 12 }, (_, i) => ({
                  city: "Sydney",
                  period: new Date(Date.UTC(2026, 6 - i, 1)).toISOString().slice(0, 7),
                  dwellings: 1000 + i,
                  status: "",
                })),
              },
              now
            );
      expect(candidate).not.toBeNull();
      const video = await renderStatReel(candidate!.stat, kind === "change" ? "light" : "navy", {
        script: candidate!.script,
        subtitles: true,
      });
      expect(video.narrated).toBe(true);
      expect(video.subtitled).toBe(true);
      expect(video.seconds).toBeGreaterThan(15);
      expect(video.seconds).toBeLessThanOrEqual(32);
      expect(video.bytes.length).toBeGreaterThan(100_000);
      if (kind === "checklist") {
        const story = await renderReelStory(video);
        expect(story.narrated && story.subtitled).toBe(true);
        expect(story.seconds).toBeLessThan(video.seconds);
        expect(story.seconds).toBeLessThanOrEqual(35);
        expect(story.bytes.length).toBeGreaterThan(100_000);
      }
    },
    180_000
  );
  it("renders the eight-capital explanation with male narration and subtitles", async () => {
    const now = new Date("2026-09-08T10:00:00Z");
    const candidate = verifiedCapitalRentReel(
      {
        status: "available",
        retrievedAt: now.toISOString(),
        observations: RENT_CITIES.map((city, index) => ({
          city,
          period: "2026-07",
          annualPercent: [3.5, 3.1, 4.6, 4.2, 5.3, 2.1, 3.8, 1.9][index]!,
          status: "",
        })),
      },
      now
    )!;
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
  it("renders the complete approvals story with spoken subtitles inside the duration limit", async () => {
    const now = new Date("2026-09-08T10:00:00Z");
    const data = parseAbsApprovals(
      readFileSync(new URL("../markets/fixtures/abs-approvals.csv", import.meta.url), "utf8"),
      now.toISOString()
    );
    const candidate = verifiedSupplyReel(data, now)!;
    const video = await renderStatReel(candidate.stat, "navy", {
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
