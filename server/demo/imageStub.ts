/**
 * Demo image generator. Returns a deterministic SVG data URL so the UI shows
 * a hero image without a real generation backend. The prompt is hashed into
 * a hue so different prompts get different gradients.
 *
 * Designed to look like editorial cover art — deep navy base, amber accent
 * spotlight, faint data-curve overlay, film grain.
 */
import type { GenerateImageOptions } from "../core/image";

function hashFromPrompt(prompt: string): number {
  let hash = 5381;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash * 33 + prompt.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function demoImage({ prompt }: GenerateImageOptions): Promise<{ url: string }> {
  // Latency keeps the UI's loading state visible.
  await new Promise((r) => setTimeout(r, 800));

  const hash = hashFromPrompt(prompt);
  const accent = hash % 360;
  const secondary = (accent + 180 + (hash % 60) - 30) % 360;
  const curvePhase = (hash % 40) - 20;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(240, 30%, 6%)"/>
        <stop offset="55%" stop-color="hsl(${accent}, 22%, 10%)"/>
        <stop offset="100%" stop-color="hsl(${secondary}, 30%, 12%)"/>
      </linearGradient>
      <radialGradient id="spot1" cx="78%" cy="22%" r="62%">
        <stop offset="0%" stop-color="hsl(${accent}, 95%, 65%)" stop-opacity="0.45"/>
        <stop offset="40%" stop-color="hsl(${accent}, 80%, 50%)" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="hsl(${accent}, 80%, 50%)" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="spot2" cx="14%" cy="86%" r="55%">
        <stop offset="0%" stop-color="hsl(${secondary}, 80%, 55%)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="hsl(${secondary}, 80%, 55%)" stop-opacity="0"/>
      </radialGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/>
      </filter>
    </defs>

    <rect width="1600" height="800" fill="url(#base)"/>
    <rect width="1600" height="800" fill="url(#spot1)"/>
    <rect width="1600" height="800" fill="url(#spot2)"/>

    <!-- Data curves — abstract editorial overlay. -->
    <g stroke="hsl(${accent}, 95%, 75%)" stroke-width="1.25" fill="none" stroke-opacity="0.16">
      <path d="M0,${480 + curvePhase} C400,${420 + curvePhase} 800,${560 + curvePhase} 1200,${480 + curvePhase} S2000,${440 + curvePhase} 2000,${440 + curvePhase}"/>
      <path d="M0,${540 + curvePhase} C400,${500 + curvePhase} 800,${620 + curvePhase} 1200,${540 + curvePhase} S2000,${520 + curvePhase} 2000,${520 + curvePhase}"/>
      <path d="M0,${600 + curvePhase} C400,${580 + curvePhase} 800,${680 + curvePhase} 1200,${600 + curvePhase} S2000,${600 + curvePhase} 2000,${600 + curvePhase}"/>
    </g>

    <!-- Subtle grid for the data-driven feel. -->
    <g stroke="hsl(${accent}, 80%, 80%)" stroke-opacity="0.04" stroke-width="0.5">
      ${Array.from({ length: 16 })
        .map((_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="800"/>`)
        .join("")}
      ${Array.from({ length: 8 })
        .map((_, i) => `<line x1="0" y1="${i * 100}" x2="1600" y2="${i * 100}"/>`)
        .join("")}
    </g>

    <!-- Film grain. -->
    <rect width="1600" height="800" filter="url(#grain)" opacity="0.6"/>

    <!-- Editorial slug. -->
    <text x="60" y="80" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="4" fill="hsl(${accent}, 95%, 80%)" fill-opacity="0.42">
      THE DESK · DEMO COVER
    </text>
  </svg>`;

  const encoded = Buffer.from(svg, "utf-8").toString("base64");
  return { url: `data:image/svg+xml;base64,${encoded}` };
}
