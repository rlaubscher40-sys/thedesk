/** Pinned, free local speech assets. Downloads happen at build time only. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve("dist/voice");
const revision = "1939ad2a8e416c0acfeecc08a694d14ef25f2231";
const base = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${revision}`;
const assets = [
  ["config.json", "df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f"],
  ["tokenizer.json", "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34"],
  ["tokenizer_config.json", "be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20"],
  ["onnx/model_quantized.onnx", "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478"],
  ["README.md", "b8fd888b4782f4d4ae85e2f1587cafd727037f4f138f72429ef1bd5908c0e9d8"],
];
await fs.mkdir(root, { recursive: true });
await fs.copyFile("docs/reel-voice-notices.txt", path.join(root, "THIRD-PARTY-NOTICES.txt"));
await fs.copyFile("scripts/speak-reel.mjs", path.join(root, "speak.mjs"));
for (const [name, hash] of assets) {
  const file = path.join(root, "kokoro", name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== hash) {
    const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Voice asset download failed: ${name} (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error(`Voice asset checksum mismatch: ${name}`);
    await fs.writeFile(file, bytes);
  }
}
console.log(
  "Pinned local Reel voice installed (Kokoro / George, male UK English). No paid speech API."
);
