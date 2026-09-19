/** Offline export only. Never sets a publication approval or calls Meta.
 * node --import tsx scripts/review-documentary.ts <episode-id|all> /absolute/new-directory [prepared-audio-directory] */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { DOCUMENTARY_EPISODES } from "../server/instagram/documentaryEpisodes";
import { documentaryCandidate } from "../server/instagram/verifiedDocumentaryReel";
import { documentaryReviewHash } from "../server/video/documentaryStory";
import { assertProductionCandidate, productionReelOptions } from "../server/video/reelProduction";
import { renderStatReel } from "../server/video/statReel";
import { renderReelCover } from "../server/video/reelCover";
import { reelVoiceIdentity } from "../server/video/reelVoice";
import { writeDocumentaryReviewPackage } from "./lib/documentaryReviewPackage";
import { loadPreparedNarration } from "./lib/preparedNarration";

const [id, output, audioDirectory] = process.argv.slice(2);
const episodes = DOCUMENTARY_EPISODES.filter((e) => id === "all" || id === e.id);
if (!episodes.length || !output || !path.isAbsolute(output))
  throw new Error("Provide an episode ID (or all) and a new absolute output directory.");
await fs.mkdir(output);
for (const episode of episodes) {
  const candidate = documentaryCandidate(episode);
  assertProductionCandidate(candidate);
  const out: string = id === "all" ? path.join(output, episode.id) : output;
  if (out !== output) await fs.mkdir(out);
  console.log(JSON.stringify({ id: episode.id, status: "rendering", posted: false }));
  const started = Date.now();
  const cover = await renderReelCover(candidate.stat, candidate.script);
  await fs.writeFile(path.join(out, "The-Desk-Cover.jpg"), cover);
  const video = await renderStatReel(candidate.stat, "navy", {
    ...productionReelOptions(candidate.script),
    ...(audioDirectory
      ? {
          preparedNarration: await loadPreparedNarration(
            id === "all" ? path.join(audioDirectory, episode.id) : audioDirectory,
            episode.id
          ),
        }
      : {}),
  });
  const videoSha256 = createHash("sha256").update(video.bytes).digest("hex");
  await fs.writeFile(path.join(out, `The-Desk-${episode.id}.mp4`), video.bytes);
  await fs.writeFile(path.join(out, "caption.txt"), candidate.caption + "\n");
  const hash = documentaryReviewHash(candidate.stat.documentary!);
  await fs.writeFile(
    path.join(out, "review.json"),
    JSON.stringify(
      {
        status: "Review export. Not posted or automatically approved.",
        candidate,
        hash,
        seconds: video.seconds,
        videoSha256,
        timeline: video.timeline,
        delivery: video.delivery,
        production: {
          ...productionReelOptions(),
          voice: video.voice ?? reelVoiceIdentity(productionReelOptions().voice, video.spokenBy),
        },
        generatedAt: new Date().toISOString(),
        renderSeconds: (Date.now() - started) / 1000,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ id: episode.id, status: "checking-encoded-film", posted: false }));
  const audit = await writeDocumentaryReviewPackage({
    episode,
    output: out,
    timeline: video.timeline.map((scene) => ({ ...scene, phrases: scene.phrases ?? [] })),
    seconds: video.seconds,
    videoSha256,
    inputHash: hash,
    voice: video.voice,
  });
  console.log(
    JSON.stringify({
      id: episode.id,
      seconds: video.seconds,
      renderSeconds: (Date.now() - started) / 1000,
      posted: false,
      technicalReview: audit.status,
      visualSections: audit.visualSections,
    })
  );
}
