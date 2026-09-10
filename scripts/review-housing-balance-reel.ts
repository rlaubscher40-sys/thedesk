/** Render the reviewed national finding and its source trail. Never publishes. */
import fs from "node:fs/promises";
import path from "node:path";
import { HOUSING_BALANCE_SNAPSHOT } from "../shared/housingBalance";
import { verifiedHousingBalanceReel } from "../server/instagram/verifiedHousingBalanceReel";
import { renderStatReel, composeSections, layout } from "../server/video/statReel";
import { synthesisePhrases } from "../server/video/phraseSpeech";
import { renderStoryFrame } from "../server/video/storyboard";
const args = process.argv.slice(2),
  at = args.indexOf("--out");
if (at < 0 || !args[at + 1])
  throw new Error("Use --out /absolute/review-directory [--frames-only] [--opening consequence]");
const out = path.resolve(args[at + 1]!);
const openingAt = args.indexOf("--opening");
const opening = openingAt < 0 ? "question" : args[openingAt + 1];
if (opening !== "question" && opening !== "consequence") throw new Error("Unknown opening.");
const candidate = verifiedHousingBalanceReel(
  HOUSING_BALANCE_SNAPSHOT,
  new Date("2026-09-10T12:00:00Z"),
  opening
);
if (!candidate?.stat.storyboard) throw new Error("No verified housing balance story.");
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "The-Desk-Housing-Gap-Caption.txt"), candidate.caption + "\n");
await fs.writeFile(
  path.join(out, "review.json"),
  JSON.stringify({ status: "Review only; not posted", ...candidate }, null, 2)
);
for (const scene of candidate.stat.storyboard.scenes)
  await fs.writeFile(
    path.join(out, scene.key + ".jpg"),
    await renderStoryFrame(candidate.stat.storyboard, scene.key, 1, "navy")
  );
if (!args.includes("--frames-only")) {
  if (candidate.stat.storyboard.kind === "housing-balance") {
    // This audit also warms the bounded exact-script speech cache. The render
    // below reuses the same local audio, with no second model run.
    const speech = await synthesisePhrases(candidate.stat.storyboard.scenes);
    for (const s of speech) await fs.writeFile(path.join(out, `speech-${s.key}.wav`), s.bytes);
    const durations = Object.fromEntries(speech.map((s) => [s.key, (s.bytes.length - 44) / 48000]));
    const phrases = Object.fromEntries(speech.map((s) => [s.key, s.phrases]));
    const audit = {
      seconds: layout(composeSections(candidate.stat, durations, phrases)).total,
      durations,
      phrases,
    };
    await fs.writeFile(path.join(out, "speech-audit.json"), JSON.stringify(audit, null, 2));
    console.log(JSON.stringify({ measuredSeconds: audit.seconds, durations }));
  }
  const rendered = await renderStatReel(candidate.stat, "navy", {
    script: candidate.script,
    subtitles: true,
  });
  const file = path.join(out, "The-Desk-Housing-Gap-Reel.mp4");
  await fs.writeFile(file, rendered.bytes);
  await fs.writeFile(path.join(out, "timing.json"), JSON.stringify(rendered.timeline, null, 2));
  console.log(
    JSON.stringify({
      file,
      seconds: rendered.seconds,
      narrated: rendered.narrated,
      subtitled: rendered.subtitled,
    })
  );
}
