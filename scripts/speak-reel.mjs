/** Runs in a killable child process, with one CPU thread and no remote model access. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KokoroTTS } from "kokoro-js";
import { AutoTokenizer, StyleTextToSpeech2Model, env } from "@huggingface/transformers";

// Models/tokenizer come from the checksum-verified build; voices and phonemizer
// are included in pinned npm packages. A publish request must never download.
env.allowRemoteModels = false;
env.useFSCache = false;
globalThis.fetch = async () => {
  throw new Error("Network disabled in local narration.");
};
const root = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(root, "kokoro");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 16000) throw new Error("Speech input too long.");
}
const lines = input
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
if (
  !lines.length ||
  lines.length > 9 ||
  lines.some(
    (l) =>
      typeof l.text !== "string" ||
      !l.text.trim() ||
      l.text.length > 1000 ||
      typeof l.output_file !== "string" ||
      !["bm_george", "bm_fable", "bm_daniel"].includes(l.voice ?? "bm_fable") ||
      !Number.isFinite(l.speed ?? 1.0) ||
      (l.speed ?? 1.0) < 0.9 ||
      (l.speed ?? 1.0) > 1.1
  )
) {
  throw new Error("Invalid speech passages.");
}
const model = await StyleTextToSpeech2Model.from_pretrained(modelPath, {
  dtype: "q8",
  device: "cpu",
  local_files_only: true,
  session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
});
try {
  const tokenizer = await AutoTokenizer.from_pretrained(modelPath, { local_files_only: true });
  const tts = new KokoroTTS(model, tokenizer);
  for (const line of lines) {
    const audio = await tts.generate(line.text, {
      voice: line.voice ?? "bm_fable",
      speed: line.speed ?? 1.0,
    });
    // Preserve the existing PCM16 validator/mixer contract. No NaNs or silence
    // are accepted downstream; do not hide a model failure with an empty file.
    const samples = audio.audio;
    if (audio.sampling_rate !== 24000 || samples.length > 24000 * 30)
      throw new Error("Invalid speech duration.");
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(24000, 24);
    wav.writeUInt32LE(48000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(samples.length * 2, 40);
    for (let i = 0; i < samples.length; i++) {
      if (!Number.isFinite(samples[i])) throw new Error("Non-finite speech sample.");
      wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
    }
    await fs.writeFile(line.output_file, wav);
  }
} finally {
  await model.dispose();
}
