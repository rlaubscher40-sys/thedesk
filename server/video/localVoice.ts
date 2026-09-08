import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

export const SPEECH_TIMEOUT_MS = 90_000;
const CACHE_LIMIT = 4;
type SpeechLine = { key: string; text: string };
type SpeechAudio = { key: string; bytes: Buffer };
const cache = new Map<string, SpeechAudio[]>();
const inFlight = new Map<string, Promise<SpeechAudio[]>>();
let queue: Promise<unknown> = Promise.resolve();

export function speechProcessFailure(error: {
  code?: string | number | null;
  signal?: string | null;
  killed?: boolean;
}) {
  if (error.killed) return `Local narration exceeded its ${SPEECH_TIMEOUT_MS / 1000}-second limit.`;
  if (error.code === "ENOENT")
    return "Local narration executable or one of its runtime libraries is missing.";
  if (error.code === "EACCES") return "Local narration executable is not permitted to run.";
  if (error.signal)
    return `Local narration was stopped by ${error.signal}. Check server memory and CPU limits.`;
  return `Local narration exited with code ${error.code ?? "unknown"}. Check the voice runtime log.`;
}

// Installed at build time, never downloaded in a publishing request.
export const voiceRoot = () => path.resolve("dist/voice");
export const voiceBinary = () => path.join(voiceRoot(), "speak.mjs");
export const voiceModel = () => path.join(voiceRoot(), "kokoro/onnx/model_quantized.onnx");

/** Reject empty, silent, malformed or implausibly long PCM output. */
export function audibleWave(bytes: Buffer): boolean {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    return false;
  let rate = 0,
    channels = 0,
    data: Buffer | undefined;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(at + 4),
      end = at + 8 + size;
    if (end > bytes.length) return false;
    const id = bytes.toString("ascii", at, at + 4);
    if (id === "fmt ") {
      if (size < 16 || bytes.readUInt16LE(at + 8) !== 1 || bytes.readUInt16LE(at + 22) !== 16)
        return false;
      channels = bytes.readUInt16LE(at + 10);
      rate = bytes.readUInt32LE(at + 12);
    }
    if (id === "data") data = bytes.subarray(at + 8, end);
    at = end + (size % 2);
  }
  if (!data || channels !== 1 || rate < 16000 || rate > 48000 || data.length % 2) return false;
  const seconds = data.length / (rate * 2);
  if (seconds < 0.15 || seconds > 30) return false;
  let audible = 0;
  for (let at = 0; at < data.length; at += 2) if (Math.abs(data.readInt16LE(at)) > 100) audible++;
  return audible > rate * 0.05;
}

export async function localSpeech(lines: SpeechLine[]): Promise<SpeechAudio[]> {
  if (
    !lines.length ||
    lines.length > 8 ||
    lines.some((l) => !l.text.trim() || l.text.length > 1000)
  )
    throw new Error("Narration script is empty or too long.");
  // Stable exact-script identity. Different numbers never reuse another read.
  const key = createHash("sha256").update(JSON.stringify(lines)).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (inFlight.size >= 2)
    throw new Error("Local narration is busy. The automatic publisher will retry safely.");
  // Only one model process at a time. Readiness, previews and publishing used
  // to load separate high-quality models concurrently on the same small host.
  const input = lines.map((line) => ({ ...line }));
  const task = queue.then(async () => {
    const audio = await runLocalSpeech(input);
    cache.set(key, audio);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    return audio;
  });
  queue = task.catch(() => {});
  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

async function runLocalSpeech(lines: SpeechLine[]): Promise<SpeechAudio[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-voice-"));
  try {
    for (const file of [
      voiceBinary(),
      voiceModel(),
      path.join(voiceRoot(), "kokoro/tokenizer.json"),
    ]) {
      await fs.access(file).catch(() => {
        throw new Error(
          `Local narration asset missing: ${path.basename(file)}. Rebuild the voice assets.`
        );
      });
    }
    const files = lines.map((_, i) => path.join(dir, `${i}.wav`));
    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [voiceBinary()],
        { timeout: SPEECH_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 256 * 1024 },
        (error, _stdout, stderr) => {
          if (!error) {
            resolve();
            return;
          }
          const detail = speechProcessFailure(error);
          console.error(`[voice] ${detail} Passages: ${lines.length}. ${stderr.slice(-1500)}`);
          reject(new Error(detail));
        }
      );
      child.stdin?.on("error", () => {});
      child.stdin?.end(
        lines.map((l, i) => JSON.stringify({ text: l.text, output_file: files[i] })).join("\n") +
          "\n"
      );
    });
    return await Promise.all(
      lines.map(async (line, i) => {
        const bytes = await fs.readFile(files[i]!);
        if (!audibleWave(bytes))
          throw new Error(`Narration passage ${i + 1} did not contain valid audible speech.`);
        return { key: line.key, bytes };
      })
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

let checked: { at: number; ok: boolean } | undefined;
export async function localVoiceReady(): Promise<boolean> {
  if (checked && Date.now() - checked.at < (checked.ok ? 300_000 : 15_000)) return checked.ok;
  try {
    await localSpeech([{ key: "check", text: "The Desk. Voice check." }]);
    checked = { at: Date.now(), ok: true };
  } catch {
    checked = { at: Date.now(), ok: false };
  }
  return checked.ok;
}
