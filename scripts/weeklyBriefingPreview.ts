/** Offline fixtures only. Never uploads to Meta or reads production credentials. */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Edition } from "../server/db/schema";
import {
  renderWeeklyCoverCard,
  renderWeeklyStoryVertical,
  renderWeeklyTopicCard,
} from "../server/og/instagramCards";

const destination = process.argv[2] ?? "/tmp/weekly-briefing-preview";
await fs.mkdir(destination, { recursive: true });
const topics = [
  {
    title: "Value of dwellings falls 0.3%",
    summary:
      "In this design fixture, the total value of Australian dwellings fell 0.3% over the June quarter. This is sample text for layout review, not a current market report.",
  },
  {
    title: "Sydney housing approvals rise in July",
    summary:
      "This fixture tests how a supporting story explains the reporting period and housing measure in a short paragraph.",
  },
  {
    title: "Brisbane rents rise over the year",
    summary:
      "This fixture tests a second supporting story with a different housing measure and location.",
  },
  {
    title: "RBA keeps the cash rate unchanged",
    summary:
      "This fixture tests a lending story with enough source detail to explain the headline.",
  },
].map((topic, i) => ({
  ...topic,
  category: "PROPERTY",
  sourceItemIds: [i + 1],
  socialSource: {
    feedItemId: i + 1,
    publisher: "Design fixture",
    feedDate: "2026-09-10",
    url: "https://example.org/fixture",
  },
}));
const edition = {
  editionNumber: 17,
  weekOf: "2026-09-07",
  weekRange: "7 Sept - 13 Sept 2026",
  topics,
} as Edition;
const rows: import("sharp").OverlayOptions[] = [];
for (const [row, variant] of (["light", "navy"] as const).entries()) {
  const images = [
    await renderWeeklyCoverCard(edition, null, variant),
    await renderWeeklyTopicCard(topics[0]!, 1, 5, variant),
    ...(await Promise.all(
      ([0, 1, 2] as const).map((frame) => renderWeeklyStoryVertical(edition, null, variant, frame))
    )),
  ];
  for (const [i, bytes] of images.entries()) {
    await fs.writeFile(path.join(destination, `${variant}-${i}.jpg`), bytes);
    rows.push({
      input: await sharp(bytes).resize(300).png().toBuffer(),
      left: 16 + i * 316,
      top: 75 + row * 560,
    });
  }
}
rows.push({
  input: Buffer.from(
    '<svg width="1596" height="55"><text x="16" y="28" font-family="sans-serif" font-size="21">Weekly briefing: cover, story slide, then the three automatic Stories</text><text x="16" y="50" font-family="sans-serif" font-size="16">DESIGN FIXTURES ONLY. Sample content, not current market reporting.</text></svg>'
  ),
  left: 0,
  top: 0,
});
await sharp({ create: { width: 1596, height: 1200, channels: 3, background: "#d9d9d9" } })
  .composite(rows)
  .png()
  .toFile(path.join(destination, "review.png"));
console.log(path.join(destination, "review.png"));
