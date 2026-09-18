import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import ffmpegPath from "ffmpeg-static";
import type { ReelVoiceIdentity } from "../../server/video/reelVoice";
import type { DocumentaryEpisode } from "../../server/instagram/documentaryEpisodes";
import {
  documentaryProductionDossier,
  DOCUMENTARY_REVIEW_BAR,
} from "../../server/video/documentaryProduction";
import {
  measuredDocumentaryShots,
  type DocumentaryTimeline,
} from "../../server/video/documentaryShotPlan";

const run = promisify(execFile);
const clock = (time: number) =>
  `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, "0")}`;

export function parseDocumentaryAudioAudit(log: string) {
  const match = log.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error("Audio measurement is missing.");
  const data = JSON.parse(match[0]);
  const result = {
    integratedLufs: Number(data.input_i),
    truePeakDbtp: Number(data.input_tp),
    loudnessRange: Number(data.input_lra),
  };
  if (!Object.values(result).every(Number.isFinite))
    throw new Error("Audio is silent or cannot be measured.");
  return result;
}

export async function writeDocumentaryReviewPackage(input: {
  episode: DocumentaryEpisode;
  output: string;
  timeline: DocumentaryTimeline;
  seconds: number;
  videoSha256: string;
  inputHash: string;
  voice?: ReelVoiceIdentity;
}) {
  const { episode, output, timeline, seconds } = input;
  if (!path.isAbsolute(output) || !ffmpegPath)
    throw new Error("Review output or encoder unavailable.");
  const video = path.join(output, `The-Desk-${episode.id}.mp4`);
  const hash = createHash("sha256")
    .update(await fs.readFile(video))
    .digest("hex");
  if (hash !== input.videoSha256) throw new Error("The MP4 changed before review packaging.");
  const shots = measuredDocumentaryShots(episode, timeline, seconds);
  const dossier = { ...documentaryProductionDossier(episode), voice: input.voice ?? null };
  await fs.writeFile(
    path.join(output, "production-dossier.json"),
    JSON.stringify(dossier, null, 2)
  );
  await fs.writeFile(path.join(output, "shot-list.json"), JSON.stringify(shots, null, 2));
  const sourceNotes = [
    `# ${episode.scenes[0]!.chapter}: sources`,
    "",
    "Money is AUD. Historical conversion is not inflation adjustment. Source descriptions and dates accompany each claim.",
    "",
    ...Object.entries(dossier.sources).flatMap(([id, source]) => [
      `## ${id}`,
      "",
      `[${source.title}](${source.url})`,
      "",
      `${source.publisher} / ${source.published}`,
      "",
      source.context,
      "",
    ]),
    "## Archive catalogue",
    "",
    "Complete available documentary catalogue; filenames identify each asset. The film's on-screen credits identify the images used.",
    ...(episode.treatment === "series-led-v1"
      ? [
          "The Desk's adapted photographic sequences are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Individual source images retain their recorded licences. Cropping, reframing, camera movement, colour treatment, titles and credits are adaptations. This notice does not relicense the underlying sources or imply endorsement.",
          "",
        ]
      : []),
    "",
    ...Object.values(dossier.archiveCatalogue).flatMap((photo) => [
      `- [${photo.credit}](${photo.source}) · [Reuse terms](${photo.licence})`,
      `  ${photo.purpose} ${photo.changes}`,
      ...("archive" in photo ? [`  [Supplying archive](${photo.archive})`] : []),
      "",
    ]),
  ].join("\n");
  await fs.writeFile(path.join(output, "sources.md"), sourceNotes);

  // Analyse actual encoded bytes. These measurements cannot substitute for listening.
  const level = await run(
    ffmpegPath,
    [
      "-hide_banner",
      "-i",
      video,
      "-vn",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-",
    ],
    { timeout: 90_000, maxBuffer: 1024 * 1024 }
  );
  const audio = parseDocumentaryAudioAudit(level.stderr);
  const duration = await run(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      video,
      "-map",
      "0:a:0",
      "-progress",
      "pipe:1",
      "-f",
      "null",
      "-",
    ],
    { timeout: 60_000, maxBuffer: 1024 * 1024 }
  );
  const audioTimes = [...duration.stdout.matchAll(/out_time_us=(\d+)/g)].map(
    (m) => Number(m[1]) / 1e6
  );
  const audioSeconds = Math.max(...audioTimes);
  const voiceEnd = Math.max(
    ...timeline.flatMap((s) => s.phrases.map((p) => s.start + p.start + p.seconds))
  );
  if (!Number.isFinite(audioSeconds) || audioSeconds + 0.05 < voiceEnd)
    throw new Error("Encoded audio ends before the measured narration.");
  if (episode.treatment && audioSeconds + 0.05 < seconds)
    throw new Error("The score fade ends before the picture.");
  if (audio.truePeakDbtp > -1 || audio.integratedLufs < -23 || audio.integratedLufs > -12)
    throw new Error("Encoded audio is outside the documentary mix limits.");
  if (
    !/Video: h264/.test(level.stderr) ||
    !/1080x1920/.test(level.stderr) ||
    !/30 fps/.test(level.stderr) ||
    !/Audio: aac.*48000 Hz, stereo/.test(level.stderr)
  )
    throw new Error("Encoded film does not match the production media format.");

  const samples = shots.map((s) => ({ id: s.id, title: s.title, time: s.inspectAt }));
  samples.push(
    { id: "opening", title: "Opening frame", time: 0.25 },
    { id: "ending", title: "Complete ending", time: seconds - 0.25 }
  );
  const frameDir = path.join(output, "frames");
  await fs.mkdir(frameDir);
  const files: string[] = [];
  for (const [i, sample] of samples.entries()) {
    const file = path.join(frameDir, `frame-${String(i + 1).padStart(2, "0")}.jpg`);
    await run(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        sample.time.toFixed(3),
        "-i",
        video,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        file,
      ],
      { timeout: 30_000 }
    );
    files.push(file);
  }
  for (let page = 0; page * 12 < samples.length; page++) {
    const canvas = createCanvas(1080, 1536),
      c = canvas.getContext("2d");
    c.fillStyle = "#eee9da";
    c.fillRect(0, 0, 1080, 1536);
    c.font = "20px sans-serif";
    c.fillStyle = "#111714";
    for (let cell = 0; cell < 12; cell++) {
      const i = page * 12 + cell;
      if (i >= samples.length) break;
      const x = (cell % 4) * 270,
        y = Math.floor(cell / 4) * 512;
      c.fillText(`${samples[i]!.id} / ${clock(samples[i]!.time)}`, x + 8, y + 23);
      c.drawImage(await loadImage(files[i]!), x, y + 32, 270, 480);
    }
    await fs.writeFile(
      path.join(output, `Scene-review-${page + 1}.jpg`),
      canvas.toBuffer("image/jpeg")
    );
  }
  const pacingFlags = shots
    .filter((s) => s.seconds < 1.2 || s.seconds > 8)
    .map((s) => ({
      id: s.id,
      seconds: s.seconds,
      reason: s.seconds < 1.2 ? "Check reading time" : "Check sustained visual interest",
    }));
  const audit = {
    status: "technical-checks-passed",
    episodeId: episode.id,
    inputHash: input.inputHash,
    videoSha256: hash,
    seconds,
    audioSeconds,
    voiceEnd,
    voice: input.voice ?? null,
    audio,
    visualSections: shots.length,
    frameSamples: samples,
    pacingFlags,
    manualReview: "pending",
    posted: false,
  };
  await fs.writeFile(path.join(output, "technical-review.json"), JSON.stringify(audit, null, 2));
  const review = [
    `# ${episode.scenes[0]!.chapter}: production review`,
    "",
    `${clock(seconds)} / ${shots.length} visual sections / ${input.voice ? `${input.voice.engine}: ${input.voice.voice}` : "voice not recorded"} / AUD`,
    "",
    "Technical checks passed. Creative review and a full listen are still required. This export does not post or approve itself.",
    "",
    `Audio: ${audio.integratedLufs} LUFS, ${audio.truePeakDbtp} dBTP. The encoded audio covers the complete measured narration.`,
    "",
    `Pacing items to inspect: ${pacingFlags.length}. See technical-review.json. These are prompts for editorial judgement, not automatic failures.`,
    "",
    "## Ten-part editorial review",
    "",
    ...DOCUMENTARY_REVIEW_BAR.map((item) => `- [ ] ${item.question}`),
    "",
    "## Timed visual plan",
    "",
    "| Time | Visual purpose | Duration |",
    "| --- | --- | ---: |",
    ...shots.map(
      (s) => `| ${clock(s.start)} | ${s.title.replaceAll("|", "/")} | ${s.seconds.toFixed(1)}s |`
    ),
    "",
    "## Export identity",
    "",
    `Input: \`${input.inputHash}\``,
    "",
    `MP4: \`${hash}\``,
    "",
    "The source dossier, narration, caption, source links and frame sheets accompany this file. Keep the same export identity when recording a review.",
    "",
  ].join("\n");
  await fs.writeFile(path.join(output, "production-review.md"), review);
  return audit;
}
