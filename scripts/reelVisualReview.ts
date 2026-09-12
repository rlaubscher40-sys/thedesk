/** Offline rehearsal of saved verified programme candidates. Never publishes.
 * node --import tsx scripts/reelVisualReview.ts programme.json output-directory
 * Optional third argument: comma-separated recipe names. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  assertProductionCandidate,
  productionReelOptions,
  type ProductionReelCandidate,
} from "../server/video/reelProduction";
import { renderStatReel } from "../server/video/statReel";
import { REEL_VISUAL_SEQUENCES } from "../server/video/reelVisualStandard";

const [input, destination, filter] = process.argv.slice(2);
if (!input || !destination) throw new Error("Provide a saved programme JSON and output directory.");
const programme: Array<{ topic: string; candidate: ProductionReelCandidate | null }> = JSON.parse(
  await fs.readFile(input, "utf8")
);
const out = path.resolve(destination);
await fs.mkdir(out, { recursive: true });
const selected = filter?.split(",");
for (const entry of programme) {
  if (!entry.candidate) continue;
  const candidate = entry.candidate;
  const recipe = candidate.stat.visualStory?.recipe ?? "housing-balance";
  if (selected && !selected.includes(recipe)) continue;
  assertProductionCandidate(candidate);
  const video = await renderStatReel(
    candidate.stat,
    "navy",
    productionReelOptions(candidate.script)
  );
  const filename = `The-Desk-${recipe}-Preview.mp4`;
  await fs.writeFile(path.join(out, filename), video.bytes);
  await fs.writeFile(
    path.join(out, `${recipe}-review.json`),
    JSON.stringify(
      {
        status: "Offline archived-source rehearsal. Not published or a new eligibility decision.",
        topic: entry.topic,
        candidate,
        visualSequence: REEL_VISUAL_SEQUENCES[recipe],
        seconds: video.seconds,
        narrated: video.narrated,
        subtitled: video.subtitled,
        voice: productionReelOptions().voice,
        timeline: video.timeline,
        sha256: createHash("sha256").update(video.bytes).digest("hex"),
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      recipe,
      filename,
      seconds: video.seconds,
      narrated: video.narrated,
      subtitled: video.subtitled,
    })
  );
}
