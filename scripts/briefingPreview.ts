/** Offline rehearsal: actual archived feed inputs or clearly labelled fixtures. Never posts. */
import fs from "node:fs/promises";
import sharp from "sharp";
import { buildBriefingSlides, briefingCaption, briefingReady } from "../server/instagram/briefing";
import { renderBriefingSlide } from "../server/og/briefingCards";
import { pickPropertyStories } from "../server/instagram/propertyEditorial";
import type { DailyFeedItem } from "../server/db/schema";

const input = process.argv[2];
const out = process.argv[3] ?? "/tmp/briefing-review";
if (!input) throw new Error("Provide saved public feed JSON and an output directory");
const json = JSON.parse(await fs.readFile(input, "utf8"));
const feed: DailyFeedItem[] = json.result?.data?.json ?? json;
const ready = pickPropertyStories(feed.filter(briefingReady), 12);
// Review the user's specific archived lead when present, without changing live selection.
const wanted = ready.find((s) => s.id === 3840168);
const selected = wanted
  ? [wanted, ...ready.filter((s) => s.id !== wanted.id).slice(0, 2)]
  : ready.slice(0, 3);
if (!selected.length) throw new Error("No usable source stories");
const slides = buildBriefingSlides(selected);
await fs.mkdir(out, { recursive: true });
const tiles: sharp.OverlayOptions[] = [];
for (const variant of ["navy", "light"] as const) {
  for (const [i, slide] of slides.entries()) {
    const bytes = await renderBriefingSlide(slide, i, slides.length, variant);
    await fs.writeFile(`${out}/${variant}-${i + 1}.jpg`, bytes);
    if (variant === "navy")
      tiles.push({
        input: await sharp(bytes).resize(360).toBuffer(),
        left: (i % 3) * 384 + 20,
        top: Math.floor(i / 3) * 490 + 80,
      });
  }
}
await fs.writeFile(`${out}/story.jpg`, await renderBriefingSlide(slides[1]!, 0, 1, "navy", true));
await fs.writeFile(`${out}/caption.txt`, briefingCaption(selected));
await fs.writeFile(
  `${out}/review.json`,
  JSON.stringify(
    {
      status: "Archived-source rehearsal, not published",
      selectedIds: selected.map((s) => s.id),
      slides,
    },
    null,
    2
  )
);
tiles.push({
  input: Buffer.from(
    '<svg width="1152" height="70"><text x="20" y="29" font-family="sans-serif" font-size="23">The Desk · briefing design review</text><text x="20" y="56" font-family="sans-serif" font-size="17">Archived 11 September source material · rehearsal only · not posted</text></svg>'
  ),
  left: 0,
  top: 0,
});
await sharp({ create: { width: 1152, height: 1080, channels: 3, background: "#E3E0D9" } })
  .composite(tiles)
  .png()
  .toFile(`${out}/The-Desk-Briefing-Preview.png`);
console.log(
  JSON.stringify({
    selected: selected.map((s) => ({ id: s.id, title: s.title })),
    slides: slides.length,
    out,
  })
);
