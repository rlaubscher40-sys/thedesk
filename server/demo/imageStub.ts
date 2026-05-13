/**
 * Demo image generator. Returns a deterministic SVG data URL so the UI shows
 * a hero image without a real generation backend. The prompt is hashed into
 * a hue so different prompts get different gradients.
 */
import type { GenerateImageOptions } from "../core/image";

function hueFromPrompt(prompt: string): number {
  let hash = 0;
  for (const ch of prompt) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export async function demoImage({ prompt }: GenerateImageOptions): Promise<{ url: string }> {
  // Brief latency keeps the UI's loading state visible.
  await new Promise((r) => setTimeout(r, 800));

  const hue = hueFromPrompt(prompt);
  const accentHue = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue}, 30%, 12%)"/>
        <stop offset="60%" stop-color="hsl(${hue}, 38%, 18%)"/>
        <stop offset="100%" stop-color="hsl(${accentHue}, 70%, 22%)"/>
      </linearGradient>
      <radialGradient id="r" cx="80%" cy="20%" r="60%">
        <stop offset="0%" stop-color="hsl(${accentHue}, 90%, 60%)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="hsl(${accentHue}, 90%, 60%)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="600" fill="url(#g)"/>
    <rect width="1200" height="600" fill="url(#r)"/>
    <g stroke="hsl(${accentHue}, 90%, 70%)" stroke-width="1" stroke-opacity="0.18" fill="none">
      <path d="M0,420 C300,360 600,500 900,380 S1500,360 1500,360"/>
      <path d="M0,460 C300,420 600,540 900,440 S1500,420 1500,420"/>
      <path d="M0,500 C300,480 600,560 900,500 S1500,480 1500,480"/>
    </g>
    <text x="60" y="80" font-family="JetBrains Mono, monospace" font-size="14" letter-spacing="3" fill="hsl(${accentHue}, 95%, 75%)" fill-opacity="0.55">DEMO HERO</text>
  </svg>`;

  const encoded = Buffer.from(svg, "utf-8").toString("base64");
  return { url: `data:image/svg+xml;base64,${encoded}` };
}
