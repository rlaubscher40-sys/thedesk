/** Review any registered, currently verified topic. No publication imports or calls. */
import fs from "node:fs/promises";
import path from "node:path";
import { getVerifiedReelProgramme } from "../server/instagram/reelCandidates";
import { renderStatReel } from "../server/video/statReel";
import { productionReelOptions } from "../server/video/reelProduction";

const args = process.argv.slice(2);
const audition = args.includes("--audition-voice")
  ? args[args.indexOf("--audition-voice") + 1]
  : undefined;
if (audition && audition !== "cedar" && audition !== "marin")
  throw new Error("Audition voice must be cedar or marin.");
if (args.includes("--audition-voice") && (!audition || args.includes("--all")))
  throw new Error("Choose one topic and an explicit audition voice.");
const usage =
  "node --import tsx scripts/review-reel.ts --list\n" +
  "node --import tsx scripts/review-reel.ts --topic <publication-key> --out /absolute/new-directory\n" +
  "node --import tsx scripts/review-reel.ts --all --out /absolute/new-directory\nOptional single-topic audition: --audition-voice cedar|marin";
if (args.includes("--help")) {
  console.log(usage);
  process.exit(0);
}
const topic = args[args.indexOf("--topic") + 1];
const output = args[args.indexOf("--out") + 1];
if (
  !args.includes("--list") &&
  ((!args.includes("--all") && (!args.includes("--topic") || !topic)) ||
    !args.includes("--out") ||
    !output ||
    !path.isAbsolute(output))
)
  throw new Error(usage);
const programme = await getVerifiedReelProgramme();
if (args.includes("--list")) {
  console.log(
    JSON.stringify(
      programme.map((entry) => ({
        topic: entry.topic,
        key: entry.candidate?.publication.key ?? null,
        available: Boolean(entry.candidate),
        requirement: entry.requirement,
      })),
      null,
      2
    )
  );
} else {
  const selected = args.includes("--all")
    ? programme
    : programme.filter((entry) => entry.candidate?.publication.key === topic);
  if (!selected.some((entry) => entry.candidate))
    throw new Error(
      "No currently verified candidate for this topic. Use --list. No substitute story generated."
    );
  // A fresh directory prevents overwriting a prior reviewed export.
  await fs.mkdir(output!);
  const manifest: Array<Record<string, unknown>> = [];
  for (const entry of selected) {
    const candidate = entry.candidate;
    if (!candidate) {
      manifest.push({ topic: entry.topic, status: "withheld", requirement: entry.requirement });
      continue;
    }
    const destination = args.includes("--all")
      ? path.join(output!, candidate.publication.key.replace(/[^a-z0-9-]/gi, "-"))
      : output!;
    if (destination !== output) await fs.mkdir(destination);
    const startedAt = Date.now();
    console.log(JSON.stringify({ topic: entry.topic, status: "rendering" }));
    const production = {
      ...productionReelOptions(candidate.script),
      ...(audition ? { auditionVoice: audition as "cedar" | "marin" } : {}),
    };
    const rendered = await renderStatReel(candidate.stat, "navy", production);
    if (!rendered.narrated || !rendered.subtitled)
      throw new Error("Review requires voice and subtitles.");
    await fs.writeFile(path.join(destination, "The-Desk-Reel.mp4"), rendered.bytes);
    await fs.writeFile(
      path.join(destination, "The-Desk-Reel-Caption.txt"),
      candidate.caption + "\n"
    );
    await fs.writeFile(
      path.join(destination, "review.json"),
      JSON.stringify(
        {
          status: "Review only. Not posted.",
          generatedAt: new Date().toISOString(),
          production: audition
            ? {
                narrate: true,
                subtitles: true,
                provider: "OpenAI",
                model: "gpt-4o-mini-tts",
                voice: audition,
                reviewOnly: true,
              }
            : productionReelOptions(),
          candidate,
          seconds: rendered.seconds,
          narrated: rendered.narrated,
          subtitled: rendered.subtitled,
          timeline: rendered.timeline,
        },
        null,
        2
      )
    );
    console.log(
      JSON.stringify({
        file: path.join(destination, "The-Desk-Reel.mp4"),
        seconds: rendered.seconds,
        posted: false,
      })
    );
    manifest.push({
      topic: entry.topic,
      status: "rendered",
      file: path.join(destination, "The-Desk-Reel.mp4"),
      seconds: rendered.seconds,
      renderSeconds: (Date.now() - startedAt) / 1000,
      narrated: rendered.narrated,
      subtitled: rendered.subtitled,
    });
    // Checkpoint each expensive completed render; no candidate is substituted for a withheld topic.
    await fs.writeFile(
      path.join(output!, "manifest.json"),
      JSON.stringify({ status: "Review only. Not posted.", entries: manifest }, null, 2)
    );
  }
  await fs.writeFile(
    path.join(output!, "manifest.json"),
    JSON.stringify({ status: "Review only. Not posted.", entries: manifest }, null, 2)
  );
}
