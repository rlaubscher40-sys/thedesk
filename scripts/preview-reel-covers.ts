/** Render the same covers used by publication into full-size files and phone grids.
 * node --import tsx scripts/preview-reel-covers.ts candidates.json /absolute/new-directory
 * Input: saved, verified ProductionReelCandidate[]. Never fetches, publishes or approves. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";
import {
  assertProductionCandidate,
  type ProductionReelCandidate,
} from "../server/video/reelProduction";
import { reelCoverDesign, renderReelCover } from "../server/video/reelCover";

const [input, out] = process.argv.slice(2);
if (!input || !out || !path.isAbsolute(out))
  throw new Error("Provide candidate JSON and a new absolute output directory.");
const candidates: ProductionReelCandidate[] = JSON.parse(await fs.readFile(input, "utf8"));
if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 12)
  throw new Error("Preview requires one to twelve verified candidates.");
for (const c of candidates) assertProductionCandidate(c);
await fs.mkdir(out);
const manifest = [];
const profiles: OverlayOptions[] = [],
  squares: OverlayOptions[] = [];
for (const [i, candidate] of candidates.entries()) {
  const name = `${String(i + 1).padStart(2, "0")}-${candidate.stat.documentary?.id ?? candidate.stat.visualStory?.recipe ?? "housing-balance"}.jpg`;
  const image = await renderReelCover(candidate.stat, candidate.script);
  await fs.writeFile(path.join(out, name), image);
  profiles.push({
    input: await sharp(image)
      .extract({ left: 0, top: 240, width: 1080, height: 1440 })
      .resize(360, 480)
      .toBuffer(),
    left: (i % 3) * 364,
    top: Math.floor(i / 3) * 484,
  });
  squares.push({
    input: await sharp(image)
      .extract({ left: 0, top: 420, width: 1080, height: 1080 })
      .resize(360, 360)
      .toBuffer(),
    left: (i % 3) * 364,
    top: Math.floor(i / 3) * 364,
  });
  manifest.push({
    file: name,
    sha256: createHash("sha256").update(image).digest("hex"),
    design: reelCoverDesign(candidate.stat, candidate.script),
    candidate,
  });
}
const rows = Math.ceil(candidates.length / 3);
await sharp({ create: { width: 1088, height: rows * 484 - 4, channels: 3, background: "#0B1118" } })
  .composite(profiles)
  .png()
  .toFile(path.join(out, "The-Desk-Reel-Covers-Grid.png"));
await sharp({ create: { width: 1088, height: rows * 364 - 4, channels: 3, background: "#0B1118" } })
  .composite(squares)
  .png()
  .toFile(path.join(out, "The-Desk-Reel-Covers-Square-Crop.png"));
await fs.writeFile(
  path.join(out, "cover-review.json"),
  JSON.stringify(
    {
      status: "Cover preview only. Not published or approved.",
      createdAt: new Date().toISOString(),
      manifest,
    },
    null,
    2
  )
);
console.log(JSON.stringify({ output: out, covers: candidates.length, published: false }));
