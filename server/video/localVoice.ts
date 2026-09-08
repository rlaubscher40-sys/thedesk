import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Installed at build time, never downloaded in a publishing request.
export const voiceRoot = () => path.resolve("dist/voice");
export const voiceBinary = () => path.join(voiceRoot(), "piper/piper");
export const voiceModel = () => path.join(voiceRoot(), "en_GB-cori-high.onnx");

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

export async function localSpeech(lines: Array<{ key: string; text: string }>) {
  if (
    !lines.length ||
    lines.length > 8 ||
    lines.some((l) => !l.text.trim() || l.text.length > 1000)
  )
    throw new Error("Narration script is empty or too long.");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-voice-"));
  try {
    await fs.access(voiceModel());
    const files = lines.map((_, i) => path.join(dir, `${i}.wav`));
    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        voiceBinary(),
        ["--model", voiceModel(), "--json-input", "--length_scale", "1.03"],
        { timeout: 45_000, maxBuffer: 256 * 1024 },
        (error) => (error ? reject(new Error("Local narration failed or timed out.")) : resolve())
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
        if (!audibleWave(bytes)) throw new Error("Narration did not contain valid audible speech.");
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
