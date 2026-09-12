/** Offline design fixtures, NOT evidence for publication. Run from the repo root. */
import fs from "node:fs/promises";
import sharp from "sharp";
import type { Edition } from "../server/db/schema";
import { sourceGroundedTopic } from "../server/instagram/sourceContent";
import {
  renderWeeklyCoverCard,
  renderWeeklyStoryVertical,
  renderWeeklyTopicCard,
  renderStatCard,
} from "../server/og/instagramCards";
import { verifiedCapitalRentReel } from "../server/instagram/verifiedCapitalRentReel";
import { RENT_CITIES } from "../shared/cityRents";

const destination = process.argv[2] ?? "/tmp/thedesk-creative-review.png";
const topic = sourceGroundedTopic({
  title: "Sydney dwelling approvals: what the annual total does—and doesn't—tell you",
  category: "PROPERTY",
  sourceItemIds: [1],
  socialSource: {
    feedItemId: 1,
    publisher: "Fixture publisher",
    url: "https://example.org/source",
    feedDate: "2026-09-08",
  },
  summary:
    "Approvals count permissions to build. They are not a count of homes that have started construction or reached completion.",
});
const edition = {
  editionNumber: 12,
  weekOf: "2026-09-07",
  weekRange: "7–13 September 2026",
  topics: [topic],
} as Edition;
const longEdition = {
  ...edition,
  topics: [
    {
      ...topic,
      title:
        "Dwelling approvals rose during the latest reporting period across the capital city, while completions remain a separate measure — Greater Sydney, July 2026",
    },
  ],
};
const now = new Date("2026-09-08T10:00:00Z");
const candidate = verifiedCapitalRentReel(
  {
    status: "available",
    retrievedAt: now.toISOString(),
    observations: RENT_CITIES.map((city, i) => ({
      city,
      period: "2026-07",
      annualPercent: [3.5, 3.1, 4.6, 4.2, 5.3, 2.1, 3.8, 1.9][i]!,
      status: "",
    })),
  },
  now
)!;
const samples = [
  ["Weekly · navy", await renderWeeklyCoverCard(edition, null, "navy")],
  ["Weekly · light", await renderWeeklyCoverCard(edition, null, "light")],
  ["Supporting slide", await renderWeeklyTopicCard(topic, 0, 1, "light")],
  ["Long-title boundary", await renderWeeklyCoverCard(longEdition, null, "navy")],
  ["Story · 9:16", await renderWeeklyStoryVertical(edition, null, "light")],
  [
    "Eight-capital Reel card",
    await renderStatCard(candidate.stat, "light", {
      shape: "vertical",
      facts: candidate.stat.facts,
    }),
  ],
] as const;
const cols = 3,
  cellWidth = 400,
  cellHeight = 730,
  margin = 18;
const composites: import("sharp").OverlayOptions[] = [];
for (const [i, [label, bytes]] of samples.entries()) {
  const x = (i % cols) * cellWidth + margin;
  const y = Math.floor(i / cols) * cellHeight + 80;
  composites.push({ input: await sharp(bytes).resize(364).png().toBuffer(), left: x, top: y + 35 });
  composites.push({
    input: Buffer.from(
      `<svg width="364" height="30"><text x="0" y="22" font-family="sans-serif" font-size="18" fill="#222">${label}</text></svg>`
    ),
    left: x,
    top: y,
  });
}
composites.push({
  input: Buffer.from(
    '<svg width="1200" height="65"><text x="18" y="28" font-family="sans-serif" font-size="22" fill="#222">The Desk — phone-width design review</text><text x="18" y="54" font-family="sans-serif" font-size="17" fill="#555">Synthetic fixtures only · not published posts or current market figures</text></svg>'
  ),
  left: 0,
  top: 0,
});
await sharp({ create: { width: 1200, height: 1560, channels: 3, background: "#ddd" } })
  .composite(composites)
  .png()
  .toFile(destination);
if (process.argv.includes("--video")) {
  const { renderStatReel } = await import("../server/video/statReel");
  const video = await renderStatReel(candidate.stat, "light", {
    script: candidate.script,
    subtitles: true,
  });
  await fs.writeFile(destination.replace(/\.png$/, ".mp4"), video.bytes);
  console.log(
    JSON.stringify({ seconds: video.seconds, narrated: video.narrated, subtitled: video.subtitled })
  );
}
console.log(destination);
