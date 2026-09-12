/** Internal synthetic review, never an automatic publication input. */
import fs from "node:fs/promises";
import sharp from "sharp";
import {
  verifiedSydneyRentChange,
  verifiedSydneyBeforeBuy,
} from "../server/instagram/verifiedSydneyReels";
import { renderStatCard } from "../server/og/instagramCards";
const now = new Date("2026-09-09T08:30:00Z");
const candidates = [
  verifiedSydneyRentChange(
    {
      status: "available",
      retrievedAt: now.toISOString(),
      observations: [
        { city: "Sydney", period: "2026-07", annualPercent: 3.5, status: "" },
        { city: "Sydney", period: "2026-06", annualPercent: 3.8, status: "" },
      ],
    },
    now
  )!,
  verifiedSydneyBeforeBuy(
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
  )!,
];
const overlays: import("sharp").OverlayOptions[] = [
  {
    input: Buffer.from(
      '<svg width="800" height="70"><text x="20" y="30" font-size="20" font-family="sans-serif">Automatic story recipes — synthetic preview only</text><text x="20" y="55" font-size="16" font-family="sans-serif">Not live figures or published posts</text></svg>'
    ),
    left: 0,
    top: 0,
  },
];
for (const [i, candidate] of candidates.entries()) {
  const card = await renderStatCard(candidate.stat, i ? "navy" : "light", {
    shape: "vertical",
    facts: candidate.stat.facts,
    kicker: candidate.stat.editorialLabel,
  });
  overlays.push({
    input: await sharp(card).resize(380).png().toBuffer(),
    left: 10 + i * 400,
    top: 80,
  });
}
await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ddd" } })
  .composite(overlays)
  .png()
  .toFile("/tmp/thedesk-audience-recipes.png");
if (process.argv.includes("--video")) {
  const { renderStatReel } = await import("../server/video/statReel");
  for (const [i, candidate] of candidates.entries()) {
    const video = await renderStatReel(candidate.stat, i ? "navy" : "light", {
      script: candidate.script,
      subtitles: true,
    });
    await fs.writeFile(`/tmp/thedesk-audience-${i}.mp4`, video.bytes);
    console.log(
      JSON.stringify({
        topic: candidate.stat.label,
        seconds: video.seconds,
        narrated: video.narrated,
        subtitled: video.subtitled,
      })
    );
  }
}
