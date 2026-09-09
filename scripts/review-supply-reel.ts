/** Reproduce the posted July-2026 story from its checked-in ABS snapshot. Never publishes. */
import fs from "node:fs/promises";
import path from "node:path";
import { parseAbsApprovals } from "../server/markets/absApprovals";
import { verifiedSupplyReel } from "../server/instagram/verifiedSupplyReel";
import { renderStatReel } from "../server/video/statReel";
import { renderStoryFrame } from "../server/video/storyboard";
import { localSpeech, type SpeechProfile } from "../server/video/localVoice";

const args = process.argv.slice(2);
const outArg = args.indexOf("--out");
if (outArg < 0 || !args[outArg + 1])
  throw new Error("Use --out /absolute/review-directory [--frames-only] [--voice bm_fable]");
const out = path.resolve(args[outArg + 1]!);
const voiceArg = args.indexOf("--voice");
const voice = voiceArg < 0 ? "bm_fable" : args[voiceArg + 1];
if (!["bm_george", "bm_fable", "bm_daniel"].includes(voice!))
  throw new Error("Unknown review voice.");
const profile: SpeechProfile = { voice: voice as SpeechProfile["voice"], speed: 1.0 };
const now = new Date("2026-09-09T10:00:00Z");
const snapshot = await fs.readFile(
  new URL("../server/markets/fixtures/abs-approvals.csv", import.meta.url),
  "utf8"
);
const candidate = verifiedSupplyReel(parseAbsApprovals(snapshot, now.toISOString()), now);
if (!candidate?.stat.storyboard) throw new Error("Archived approval evidence is unavailable.");
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "The-Desk-Reel-Caption.txt"), candidate.caption + "\n");
await fs.writeFile(
  path.join(out, "review.json"),
  JSON.stringify(
    {
      status: "Review copy; not posted",
      evidence: "Checked-in ABS snapshot matching the supplied July 2026 post",
      evidenceHash: candidate.evidenceHash,
      publication: candidate.publication,
      voice: profile,
      script: candidate.script,
      storyboard: candidate.stat.storyboard,
    },
    null,
    2
  )
);
for (const scene of candidate.stat.storyboard.scenes) {
  await fs.writeFile(
    path.join(out, `${scene.key}.jpg`),
    await renderStoryFrame(candidate.stat.storyboard, scene.key, 1, "navy")
  );
}
if (!args.includes("--frames-only")) {
  const rendered = await renderStatReel(candidate.stat, "navy", {
    script: candidate.script,
    subtitles: true,
    voice: profile,
  });
  const file = path.join(out, `The-Desk-Supply-Reel-${voice}.mp4`);
  await fs.writeFile(file, rendered.bytes);
  console.log(
    JSON.stringify({
      file,
      seconds: rendered.seconds,
      narrated: rendered.narrated,
      subtitled: rendered.subtitled,
    })
  );
  const profiles =
    args.includes("--compare-voices") && profile.voice !== "bm_george"
      ? [profile, { voice: "bm_george", speed: 1.0 } as SpeechProfile]
      : [profile];
  for (const auditionProfile of profiles) {
    const audition = await localSpeech(
      [
        {
          key: "audition",
          text: "A housing approval doesn't come with a set of keys. Brisbane and Perth both approved thousands of homes. But an approval is permission to build. It doesn't tell you when someone can move in. To understand housing supply, look at what's actually being finished, alongside local demand.",
        },
      ],
      auditionProfile
    );
    await fs.writeFile(
      path.join(out, `The-Desk-Voice-${auditionProfile.voice}.wav`),
      audition[0]!.bytes
    );
  }
}
