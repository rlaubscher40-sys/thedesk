/**
 * Demo image generator.
 *
 * Returns a deterministic SVG data URL that *looks* like the cover of an
 * intelligence briefing — globe, terminal data, world map or masthead —
 * rather than the abstract blobs the first pass produced. The choice of
 * template is hashed off the prompt so different editions get different
 * but stable covers; if the prompt mentions a category, we bias toward the
 * template that suits it (GLOBE for geopolitics/macro, DASHBOARD for
 * markets, MAP for property, MASTHEAD for everything else).
 */
import type { GenerateImageOptions } from "../core/image";

type Template = "globe" | "dashboard" | "map" | "masthead";

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickTemplate(prompt: string, h: number): Template {
  const p = prompt.toLowerCase();
  if (/(geopolitic|global|world|policy|rba|economic)/.test(p)) return "globe";
  if (/(market|asx|rate|inflation|bond|equit)/.test(p)) return "dashboard";
  if (/(property|housing|listing|suburb|auction)/.test(p)) return "map";
  // Round-robin between all four for the remainder so any single template
  // doesn't dominate when prompts are similar.
  const choices: Template[] = ["globe", "dashboard", "map", "masthead"];
  return choices[h % choices.length]!;
}

export async function demoImage({ prompt }: GenerateImageOptions): Promise<{ url: string }> {
  // Brief latency keeps the UI's loading state visible.
  await new Promise((r) => setTimeout(r, 600));

  const h = hash(prompt);
  const template = pickTemplate(prompt, h);
  const svg = renderTemplate(template, h, prompt);
  const encoded = Buffer.from(svg, "utf-8").toString("base64");
  return { url: `data:image/svg+xml;base64,${encoded}` };
}

// ─── Templates ──────────────────────────────────────────────────────────────

function renderTemplate(t: Template, h: number, prompt: string): string {
  switch (t) {
    case "globe":
      return globeSvg(h, prompt);
    case "dashboard":
      return dashboardSvg(h, prompt);
    case "map":
      return mapSvg(h, prompt);
    case "masthead":
      return mastheadSvg(h, prompt);
  }
}

/** Common shared defs: gradients, grain filter, vignette. */
function commonDefs(h: number): string {
  const accent = 38 + (h % 16); // amber band
  return `
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(225, 32%, 6%)"/>
      <stop offset="55%" stop-color="hsl(225, 28%, 8%)"/>
      <stop offset="100%" stop-color="hsl(225, 30%, 4%)"/>
    </linearGradient>
    <radialGradient id="spot" cx="78%" cy="22%" r="65%">
      <stop offset="0%" stop-color="hsl(${accent}, 100%, 62%)" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="hsl(${accent}, 90%, 55%)" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="hsl(${accent}, 90%, 55%)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="80%">
      <stop offset="55%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/>
    </filter>
  `;
}

function editorialSlug(): string {
  return `
    <g font-family="JetBrains Mono, monospace" fill="hsl(38, 95%, 78%)" fill-opacity="0.55">
      <text x="60" y="78" font-size="11" letter-spacing="5">THE DESK · INTELLIGENCE</text>
      <line x1="60" y1="92" x2="200" y2="92" stroke="hsl(38, 95%, 65%)" stroke-opacity="0.4"/>
    </g>
  `;
}

function commonFinish(): string {
  return `
    <rect width="1600" height="800" fill="url(#vignette)"/>
    <rect width="1600" height="800" filter="url(#grain)" opacity="0.7"/>
    ${editorialSlug()}
  `;
}

// ─── Globe ──────────────────────────────────────────────────────────────────

function globeSvg(h: number, _prompt: string): string {
  const cx = 1140;
  const cy = 400;
  const r = 280;
  const meridianCount = 9;
  const parallelCount = 7;

  const meridians = Array.from({ length: meridianCount })
    .map((_, i) => {
      const t = i / (meridianCount - 1);
      const rx = r * Math.abs(2 * t - 1);
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${r}" />`;
    })
    .join("");

  const parallels = Array.from({ length: parallelCount })
    .map((_, i) => {
      const t = (i + 1) / (parallelCount + 1);
      const y = cy - r + r * 2 * t;
      const rx = Math.sin(t * Math.PI) * r;
      return `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${rx * 0.06}" />`;
    })
    .join("");

  // Plot a couple of "intel hotspots" at deterministic locations on the globe.
  const hotspots = [
    [0.22, 0.42, 0.9],
    [0.55, 0.32, 0.7],
    [0.68, 0.62, 1.0],
    [0.34, 0.78, 0.55],
  ]
    .map(([u, v, mag]) => {
      const angle = (u as number) * Math.PI * 2;
      const tilt = ((v as number) - 0.5) * Math.PI;
      const x = cx + Math.sin(angle) * r * 0.92 * Math.cos(tilt);
      const y = cy + Math.sin(tilt) * r * 0.92;
      const opacity = (mag as number) * 0.7;
      return `
        <circle cx="${x}" cy="${y}" r="${4 + (mag as number) * 3}" fill="hsl(38, 100%, 70%)" fill-opacity="${opacity}"/>
        <circle cx="${x}" cy="${y}" r="${10 + (mag as number) * 8}" fill="none" stroke="hsl(38, 100%, 70%)" stroke-opacity="${opacity * 0.5}"/>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(h)}
      <radialGradient id="globeFill" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="hsl(225, 40%, 16%)" stop-opacity="1"/>
        <stop offset="100%" stop-color="hsl(225, 50%, 4%)" stop-opacity="1"/>
      </radialGradient>
      <radialGradient id="globeRim" cx="50%" cy="50%" r="50%">
        <stop offset="92%" stop-color="hsl(38, 100%, 70%)" stop-opacity="0"/>
        <stop offset="98%" stop-color="hsl(38, 100%, 70%)" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="hsl(38, 100%, 70%)" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="1600" height="800" fill="url(#base)"/>
    <rect width="1600" height="800" fill="url(#spot)"/>

    <!-- Faint grid background. -->
    <g stroke="hsl(200, 30%, 70%)" stroke-opacity="0.04" stroke-width="0.5">
      ${Array.from({ length: 16 }).map((_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="800"/>`).join("")}
      ${Array.from({ length: 8 }).map((_, i) => `<line x1="0" y1="${i * 100}" x2="1600" y2="${i * 100}"/>`).join("")}
    </g>

    <!-- Globe body. -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#globeFill)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="url(#globeRim)"/>

    <!-- Latitude / longitude. -->
    <g fill="none" stroke="hsl(38, 100%, 75%)" stroke-opacity="0.18" stroke-width="0.7">
      ${meridians}
      ${parallels}
    </g>

    <!-- Hotspots -->
    ${hotspots}

    <!-- Coordinate corner labels — newsroom feel. -->
    <g font-family="JetBrains Mono, monospace" fill="hsl(38, 90%, 80%)" fill-opacity="0.35" font-size="11" letter-spacing="2">
      <text x="60" y="740">LAT 33.86 S · LON 151.20 E</text>
      <text x="60" y="760">SYDNEY · GMT+11</text>
    </g>

    ${commonFinish()}
  </svg>`;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function dashboardSvg(h: number, _prompt: string): string {
  // A faked terminal: three sparkline charts + two gauges + one bar block.
  const spark = (x: number, y: number, w: number, hgt: number, seed: number) => {
    const pts: Array<[number, number]> = Array.from({ length: 24 }).map((_, i) => {
      const t = i / 23;
      const noise =
        Math.sin(t * Math.PI * 2 + seed) * 0.18 +
        Math.sin(t * Math.PI * 5 + seed * 1.3) * 0.08 +
        (seed % 7) * 0.01;
      return [x + t * w, y + hgt - (0.5 + noise + t * 0.3) * hgt];
    });
    return pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  };

  const barBlock = Array.from({ length: 16 })
    .map((_, i) => {
      const seed = (h + i * 7) % 100;
      const heightPx = 14 + (seed % 70);
      return `<rect x="${1010 + i * 28}" y="${520 - heightPx}" width="18" height="${heightPx}" fill="hsl(38, 100%, 70%)" fill-opacity="${0.25 + (i % 4) * 0.12}"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(h)}</defs>

    <rect width="1600" height="800" fill="url(#base)"/>
    <rect width="1600" height="800" fill="url(#spot)"/>

    <!-- Background grid. -->
    <g stroke="hsl(200, 30%, 70%)" stroke-opacity="0.05" stroke-width="0.5">
      ${Array.from({ length: 16 }).map((_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="800"/>`).join("")}
      ${Array.from({ length: 8 }).map((_, i) => `<line x1="0" y1="${i * 100}" x2="1600" y2="${i * 100}"/>`).join("")}
    </g>

    <!-- Three sparkline panels in the left half. -->
    <g>
      <rect x="100" y="180" width="380" height="140" fill="hsl(225, 40%, 10%)" fill-opacity="0.6" stroke="hsl(225, 30%, 24%)" stroke-opacity="0.4"/>
      <text x="116" y="208" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" fill="hsl(38, 80%, 78%)" fill-opacity="0.6">CASH RATE</text>
      <polyline points="${spark(120, 230, 340, 60, h)}" fill="none" stroke="hsl(38, 100%, 70%)" stroke-width="1.5"/>

      <rect x="100" y="340" width="380" height="140" fill="hsl(225, 40%, 10%)" fill-opacity="0.6" stroke="hsl(225, 30%, 24%)" stroke-opacity="0.4"/>
      <text x="116" y="368" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" fill="hsl(38, 80%, 78%)" fill-opacity="0.6">AUCTION CLEARANCE</text>
      <polyline points="${spark(120, 390, 340, 60, h * 2)}" fill="none" stroke="hsl(155, 70%, 60%)" stroke-width="1.5"/>

      <rect x="100" y="500" width="380" height="140" fill="hsl(225, 40%, 10%)" fill-opacity="0.6" stroke="hsl(225, 30%, 24%)" stroke-opacity="0.4"/>
      <text x="116" y="528" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" fill="hsl(38, 80%, 78%)" fill-opacity="0.6">BROKER CHANNEL</text>
      <polyline points="${spark(120, 550, 340, 60, h * 3)}" fill="none" stroke="hsl(260, 70%, 70%)" stroke-width="1.5"/>
    </g>

    <!-- Bar chart block bottom-right. -->
    <g>
      <text x="1010" y="498" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" fill="hsl(38, 80%, 78%)" fill-opacity="0.6">SIGNALS / EDITION</text>
      ${barBlock}
    </g>

    <!-- Gauge: large numeric tile top-right. -->
    <g>
      <rect x="1010" y="180" width="490" height="280" fill="hsl(225, 40%, 10%)" fill-opacity="0.65" stroke="hsl(225, 30%, 24%)" stroke-opacity="0.4"/>
      <text x="1030" y="216" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="3" fill="hsl(38, 80%, 78%)" fill-opacity="0.6">10Y AGB</text>
      <text x="1030" y="370" font-family="Playfair Display, serif" font-size="118" font-weight="700" fill="hsl(38, 100%, 78%)" fill-opacity="0.92">4.21<tspan font-size="58" font-weight="500" fill-opacity="0.65">%</tspan></text>
      <text x="1030" y="416" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="2" fill="hsl(155, 70%, 70%)" fill-opacity="0.65">▲ +6BP THIS WEEK</text>
    </g>

    ${commonFinish()}
  </svg>`;
}

// ─── World map ─────────────────────────────────────────────────────────────

function mapSvg(h: number, _prompt: string): string {
  // Stylised continent silhouettes (very loose) on a coordinate grid.
  // Done as polygons so we don't pull in any geo library.
  const continents = [
    // North America
    "M270,260 L320,220 L400,210 L470,240 L495,290 L470,340 L420,360 L370,400 L320,420 L270,410 L240,360 L240,310 Z",
    // South America
    "M380,440 L420,440 L450,500 L440,580 L410,640 L380,650 L355,610 L350,540 L360,490 Z",
    // Europe
    "M730,210 L800,220 L840,250 L825,290 L770,295 L740,275 Z",
    // Africa
    "M780,310 L850,310 L880,370 L870,470 L820,550 L790,560 L760,510 L750,420 L765,360 Z",
    // Asia
    "M860,200 L1080,210 L1180,250 L1220,310 L1180,355 L1080,365 L960,355 L890,310 L860,260 Z",
    // Australia
    "M1140,510 L1230,510 L1280,540 L1250,580 L1180,585 L1140,560 Z",
  ];

  const hotspots = [
    [1200, 555, 1.0], // Sydney
    [430, 290, 0.7],  // NY
    [800, 250, 0.65], // London
    [1080, 290, 0.55], // Tokyo
    [820, 460, 0.45], // Africa
  ]
    .map(([x, y, mag]) => {
      const m = mag as number;
      return `
        <circle cx="${x}" cy="${y}" r="${4 + m * 3}" fill="hsl(38, 100%, 70%)" fill-opacity="${0.7 * m}"/>
        <circle cx="${x}" cy="${y}" r="${14 + m * 12}" fill="none" stroke="hsl(38, 100%, 70%)" stroke-opacity="${0.4 * m}"/>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(h)}</defs>

    <rect width="1600" height="800" fill="url(#base)"/>
    <rect width="1600" height="800" fill="url(#spot)"/>

    <!-- Lat/lon grid. -->
    <g stroke="hsl(200, 50%, 60%)" stroke-opacity="0.06" stroke-width="0.5">
      ${Array.from({ length: 18 }).map((_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="800"/>`).join("")}
      ${Array.from({ length: 9 }).map((_, i) => `<line x1="0" y1="${i * 90 + 80}" x2="1600" y2="${i * 90 + 80}"/>`).join("")}
    </g>

    <!-- Equator and Sydney parallel. -->
    <g stroke="hsl(38, 80%, 65%)" stroke-opacity="0.16" stroke-width="0.6" stroke-dasharray="4 6">
      <line x1="0" y1="400" x2="1600" y2="400"/>
      <line x1="0" y1="560" x2="1600" y2="560"/>
    </g>

    <!-- Continents. -->
    <g fill="hsl(225, 35%, 18%)" fill-opacity="0.85" stroke="hsl(38, 60%, 60%)" stroke-opacity="0.2" stroke-width="0.7">
      ${continents.map((d) => `<path d="${d}"/>`).join("")}
    </g>

    <!-- Hotspots. -->
    ${hotspots}

    <!-- Footer labels. -->
    <g font-family="JetBrains Mono, monospace" fill="hsl(38, 90%, 80%)" fill-opacity="0.35" font-size="11" letter-spacing="2">
      <text x="60" y="740">GLOBAL · INTEL FLOW · LIVE</text>
      <text x="60" y="760">5 ACTIVE SIGNALS</text>
    </g>

    ${commonFinish()}
  </svg>`;
}

// ─── Masthead ──────────────────────────────────────────────────────────────

function mastheadSvg(h: number, prompt: string): string {
  // Extract the edition number from the prompt if present (the demo seed
  // calls demoImage with "Edition 14 ..." style prompts).
  const editionMatch = prompt.match(/Edition\s+(\d+)/i);
  const editionNum = editionMatch ? editionMatch[1] : String(10 + (h % 90));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(h)}</defs>

    <rect width="1600" height="800" fill="url(#base)"/>
    <rect width="1600" height="800" fill="url(#spot)"/>

    <!-- Background grid. -->
    <g stroke="hsl(200, 30%, 70%)" stroke-opacity="0.04" stroke-width="0.5">
      ${Array.from({ length: 16 }).map((_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="800"/>`).join("")}
    </g>

    <!-- Top rule + paper-style header. -->
    <g>
      <line x1="80" y1="180" x2="1520" y2="180" stroke="hsl(38, 100%, 70%)" stroke-opacity="0.6"/>
      <line x1="80" y1="184" x2="1520" y2="184" stroke="hsl(38, 100%, 70%)" stroke-opacity="0.2"/>
      <text x="80" y="216" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="5" fill="hsl(38, 90%, 80%)" fill-opacity="0.6">EDITION No. ${editionNum} · WEEKLY INTELLIGENCE</text>
      <text x="1520" y="216" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="5" fill="hsl(38, 90%, 80%)" fill-opacity="0.6">SYDNEY · 7AM AEST</text>
    </g>

    <!-- Oversized masthead. -->
    <g>
      <text x="800" y="510" text-anchor="middle" font-family="Playfair Display, serif" font-weight="800" font-size="260" letter-spacing="-12" fill="hsl(38, 90%, 78%)" fill-opacity="0.18">The Desk</text>
      <text x="800" y="500" text-anchor="middle" font-family="Playfair Display, serif" font-weight="800" font-size="260" letter-spacing="-12" fill="hsl(38, 100%, 80%)" fill-opacity="0.92">The Desk</text>
    </g>

    <!-- Bottom dec block. -->
    <g>
      <line x1="80" y1="620" x2="1520" y2="620" stroke="hsl(38, 100%, 70%)" stroke-opacity="0.4"/>
      <line x1="80" y1="624" x2="1520" y2="624" stroke="hsl(38, 100%, 70%)" stroke-opacity="0.14"/>
      <text x="800" y="678" text-anchor="middle" font-family="Playfair Display, serif" font-style="italic" font-size="28" fill="hsl(40, 60%, 88%)" fill-opacity="0.65">Intelligence for property partnerships</text>
      <text x="800" y="730" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="6" fill="hsl(38, 90%, 80%)" fill-opacity="0.45">BY RUBEN LAUBSCHER · INVESTORKIT</text>
    </g>

    ${commonFinish()}
  </svg>`;
}
