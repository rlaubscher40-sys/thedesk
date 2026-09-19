/** Offline comparison: same source performance, two editing profiles, no synthesis or posting.
 * pnpm narration:review /absolute/script.json /absolute/timestamp-response.json /absolute/new-output */
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { narrationWave, newsreaderClips, NARRATION_PCM_LIMIT } from "../server/video/newsreader";

const [scriptFile, responseFile, output] = process.argv.slice(2);
if (![scriptFile, responseFile, output].every((p) => p && path.isAbsolute(p)))
  throw new Error("Provide absolute script, timestamp response and new output paths.");
const lines = z
  .array(
    z.object({
      key: z.string().min(1),
      text: z.string().trim().min(1).max(1000),
      protectPauseAfterWords: z.array(z.number().int().nonnegative()).optional(),
    })
  )
  .min(1)
  .max(16)
  .parse(JSON.parse(await fs.readFile(scriptFile!, "utf8")));
if (new Set(lines.map((l) => l.key)).size !== lines.length)
  throw new Error("Duplicate narration keys.");
if ((await fs.stat(responseFile!)).size > NARRATION_PCM_LIMIT * 2)
  throw new Error("Timestamp response exceeds the narration bound.");
const data = JSON.parse(await fs.readFile(responseFile!, "utf8"));
if (
  typeof data.audio_base64 !== "string" ||
  Buffer.from(data.audio_base64, "base64").toString("base64") !== data.audio_base64
)
  throw new Error("Invalid PCM response.");
const pcm = Buffer.from(data.audio_base64, "base64");
const variants = (["briefing", "documentary"] as const).map((mode) => ({
  mode,
  clips: newsreaderClips(lines, pcm, data.alignment, mode),
}));
await fs.mkdir(output!); // An existing export is never overwritten.
await fs.writeFile(path.join(output!, "source.wav"), narrationWave(pcm));
await fs.writeFile(path.join(output!, "script.json"), JSON.stringify(lines, null, 2));
for (const { mode, clips } of variants) {
  await fs.writeFile(
    path.join(output!, `${mode}.wav`),
    narrationWave(Buffer.concat(clips.map((c) => c.bytes.subarray(44))))
  );
  await fs.writeFile(
    path.join(output!, `${mode}.json`),
    JSON.stringify(
      {
        delivery: clips[0]!.delivery,
        words: clips.flatMap((c) =>
          c.words.map((w) => ({ ...w, start: c.start + w.start, end: c.start + w.end }))
        ),
      },
      null,
      2
    )
  );
}
console.log(
  JSON.stringify({
    output,
    synthesisRequests: 0,
    posted: false,
    profiles: variants.map(({ mode, clips }) => ({ mode, seconds: clips[0]!.delivery!.seconds })),
  })
);
