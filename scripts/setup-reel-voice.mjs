/** Pinned local speech assets. No API account, token, or per-request charge. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

if (process.platform !== "linux" || process.arch !== "x64") {
  console.warn("Local Reel voice is packaged for Linux x64. Reels stay unavailable on this host.");
  process.exit(0);
}
const root = path.resolve("dist/voice");
const revision = "1162a9173d0ce503555aed757976b7a9912eae4c";
const modelBase = `https://huggingface.co/rhasspy/piper-voices/resolve/${revision}/en/en_GB/cori/high`;
const assets = [
  [
    "piper.tar.gz",
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz",
    "a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992",
  ],
  [
    "en_GB-cori-high.onnx",
    `${modelBase}/en_GB-cori-high.onnx`,
    "470b4dd634c98f8a4850d7626ffc3dfc90774628eeef6605a6dd8f88f30a5903",
  ],
  [
    "en_GB-cori-high.onnx.json",
    `${modelBase}/en_GB-cori-high.onnx.json`,
    "9e7fb5b5671612c22f3c81cbe46c1ae87b031a4632bcb509e499dad6f1e2adec",
  ],
  [
    "MODEL_CARD",
    `${modelBase}/MODEL_CARD`,
    "136e7bd168b6c35b4a5df01a0253297e5773b5775ceae0af5160f264aa58208f",
  ],
];
await fs.mkdir(root, { recursive: true });
await fs.copyFile("docs/reel-voice-notices.txt", path.join(root, "THIRD-PARTY-NOTICES.txt"));
for (const [name, url, hash] of assets) {
  const file = path.join(root, name);
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== hash) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Voice asset download failed: ${name} (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error(`Voice asset checksum mismatch: ${name}`);
    await fs.writeFile(file, bytes);
  }
}
execFileSync("tar", ["-xzf", path.join(root, "piper.tar.gz"), "-C", root], { timeout: 30_000 });
execFileSync(path.join(root, "piper/piper"), ["--help"], { timeout: 10_000, stdio: "pipe" });
console.log("Pinned local Reel voice installed (Cori, UK English). No paid speech API.");
