/**
 * Demo image generator, photographic-style editorial cover art.
 *
 * Composes layered gradients, architectural silhouettes, atmospheric
 * haze and film grain to feel like the cover of an intelligence
 * briefing, not procedural decoration. Dispatched per-category:
 *
 *   PROPERTY    → financial-district cityscape at blue hour
 *   MACRO       → parliamentary / civic dome at dusk
 *   MARKETS     → market screens, tickers, depth-of-field
 *   POLICY      → parliament steps with directional light
 *   GEOPOLITICS → world at night, illuminated coastlines
 *   AI / TECH   → server-hall corridor with light streams
 *   default     → editorial masthead spread
 *
 * Each composition is fully deterministic per prompt-hash but the
 * spotlight, colour temperature and palette drift edition-to-edition.
 */
import type { GenerateImageOptions } from "../core/image";

type Template =
  | "cityscape"
  | "civic"
  | "markets"
  | "policy"
  | "world"
  | "data-hall"
  | "masthead";

// ─── Hash + dispatcher ──────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickTemplate(prompt: string, h: number): Template {
  // Earlier versions of this dispatcher tried to be clever, match the
  // prompt's category against a regex and pick the "appropriate"
  // template. The problem: every macro/budget/rba prompt hashed to the
  // civic template, so every weekly edition with a macro lead looked
  // identical. Now we rotate through all seven templates by hash so
  // consecutive editions always look different. Category-flavoured
  // colour drifting still happens inside each template's palette.
  const all: Template[] = [
    "cityscape",
    "civic",
    "markets",
    "policy",
    "world",
    "data-hall",
    "masthead",
  ];
  // Use the prompt to keep the original signal, different prompts still
  // produce different templates, but ignore category matching.
  void prompt;
  return all[h % all.length]!;
}

export async function demoImage({ prompt }: GenerateImageOptions): Promise<{ url: string }> {
  await new Promise((r) => setTimeout(r, 600));
  const h = hash(prompt);
  const template = pickTemplate(prompt, h);
  const palette = buildPalette(template, h);
  const svg = renderTemplate(template, h, prompt, palette);
  const encoded = Buffer.from(svg, "utf-8").toString("base64");
  return { url: `data:image/svg+xml;base64,${encoded}` };
}

// ─── Palette per template ──────────────────────────────────────────────────

type Palette = {
  /** Sky / background top. */
  top: string;
  /** Mid horizon. */
  mid: string;
  /** Deepest shadow. */
  bottom: string;
  /** Primary warm light source (sun, key light). */
  warm: string;
  /** Secondary cool light source (window glow, screen light). */
  cool: string;
  /** Foreground architecture / silhouettes. */
  ink: string;
  /** Accent, the amber editorial overlay. */
  accent: string;
};

function buildPalette(template: Template, h: number): Palette {
  // Per-template moodboards. Each picks a base hue triple and shifts it
  // slightly per-edition so consecutive editions look related but distinct.
  const drift = h % 12; // small hue drift in degrees

  switch (template) {
    case "cityscape": // blue hour with warm window lights
      return {
        top: `hsl(${220 + drift}, 50%, 14%)`,
        mid: `hsl(${215 + drift}, 60%, 8%)`,
        bottom: `hsl(${220 + drift}, 70%, 4%)`,
        warm: `hsl(${36 + drift}, 95%, 70%)`,
        cool: `hsl(${210 + drift}, 95%, 65%)`,
        ink: `hsl(${220 + drift}, 40%, 6%)`,
        accent: `hsl(${38 + drift}, 95%, 72%)`,
      };
    case "civic": // dusk over a civic building
      return {
        top: `hsl(${20 + drift}, 35%, 14%)`,
        mid: `hsl(${15 + drift}, 38%, 9%)`,
        bottom: `hsl(${228 + drift}, 50%, 5%)`,
        warm: `hsl(${30 + drift}, 95%, 68%)`,
        cool: `hsl(${220 + drift}, 80%, 60%)`,
        ink: `hsl(${230 + drift}, 35%, 8%)`,
        accent: `hsl(${36 + drift}, 95%, 72%)`,
      };
    case "markets": // screen glow, depth-of-field
      return {
        top: `hsl(${200 + drift}, 35%, 10%)`,
        mid: `hsl(${220 + drift}, 38%, 6%)`,
        bottom: `hsl(${230 + drift}, 45%, 3%)`,
        warm: `hsl(${42 + drift}, 95%, 70%)`,
        cool: `hsl(${155 + drift}, 80%, 60%)`,
        ink: `hsl(${225 + drift}, 50%, 5%)`,
        accent: `hsl(${36 + drift}, 95%, 72%)`,
      };
    case "policy": // marble + warm hallway light
      return {
        top: `hsl(${28 + drift}, 25%, 16%)`,
        mid: `hsl(${22 + drift}, 28%, 10%)`,
        bottom: `hsl(${20 + drift}, 30%, 5%)`,
        warm: `hsl(${36 + drift}, 95%, 75%)`,
        cool: `hsl(${24 + drift}, 60%, 50%)`,
        ink: `hsl(${22 + drift}, 25%, 8%)`,
        accent: `hsl(${36 + drift}, 95%, 75%)`,
      };
    case "world": // earth at night, atmospheric rim
      return {
        top: `hsl(${230 + drift}, 50%, 8%)`,
        mid: `hsl(${225 + drift}, 60%, 4%)`,
        bottom: `hsl(${220 + drift}, 70%, 2%)`,
        warm: `hsl(${36 + drift}, 95%, 70%)`,
        cool: `hsl(${190 + drift}, 95%, 60%)`,
        ink: `hsl(${230 + drift}, 60%, 5%)`,
        accent: `hsl(${36 + drift}, 95%, 72%)`,
      };
    case "data-hall": // server corridor, vanishing point
      return {
        top: `hsl(${210 + drift}, 40%, 10%)`,
        mid: `hsl(${215 + drift}, 50%, 6%)`,
        bottom: `hsl(${225 + drift}, 55%, 3%)`,
        warm: `hsl(${38 + drift}, 95%, 72%)`,
        cool: `hsl(${195 + drift}, 95%, 60%)`,
        ink: `hsl(${220 + drift}, 45%, 4%)`,
        accent: `hsl(${36 + drift}, 95%, 72%)`,
      };
    case "masthead":
    default:
      return {
        top: `hsl(${225 + drift}, 35%, 8%)`,
        mid: `hsl(${225 + drift}, 30%, 5%)`,
        bottom: `hsl(${228 + drift}, 35%, 3%)`,
        warm: `hsl(${38 + drift}, 95%, 72%)`,
        cool: `hsl(${220 + drift}, 60%, 50%)`,
        ink: `hsl(${230 + drift}, 25%, 6%)`,
        accent: `hsl(${36 + drift}, 95%, 72%)`,
      };
  }
}

// ─── Shared defs ────────────────────────────────────────────────────────────

function commonDefs(p: Palette, h: number): string {
  const spotX = 60 + (h % 30);
  const spotY = 12 + (h % 22);
  return `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="${p.top}"/>
      <stop offset="55%" stop-color="${p.mid}"/>
      <stop offset="100%" stop-color="${p.bottom}"/>
    </linearGradient>
    <radialGradient id="sun" cx="${spotX}%" cy="${spotY}%" r="55%">
      <stop offset="0%"  stop-color="${p.warm}" stop-opacity="0.55"/>
      <stop offset="35%" stop-color="${p.warm}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${p.warm}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="counter" cx="${(spotX + 60) % 100}%" cy="90%" r="50%">
      <stop offset="0%" stop-color="${p.cool}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${p.cool}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="haze" x1="0" y1="0.4" x2="0" y2="1">
      <stop offset="0%"  stop-color="${p.warm}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${p.warm}" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="hsl(0,0%,100%)" stop-opacity="0.08"/>
      <stop offset="55%" stop-color="hsl(0,0%,100%)" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="hsl(0,0%,100%)" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="78%">
      <stop offset="55%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.65"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/>
    </filter>
    <filter id="atmos">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  `;
}

function editorialSlug(p: Palette): string {
  return `
    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.6">
      <text x="60" y="80" font-size="11" letter-spacing="5">THE DESK · INTELLIGENCE</text>
      <line x1="60" y1="92" x2="220" y2="92" stroke="${p.accent}" stroke-opacity="0.4"/>
    </g>
  `;
}

function commonFinish(p: Palette): string {
  return `
    <rect width="1600" height="800" fill="url(#counter)"/>
    <rect width="1600" height="800" fill="url(#haze)"/>
    <rect width="1600" height="800" fill="url(#gloss)"/>
    <rect width="1600" height="800" fill="url(#vignette)"/>
    <rect width="1600" height="800" filter="url(#grain)" opacity="0.7"/>
    ${editorialSlug(p)}
  `;
}

function renderTemplate(t: Template, h: number, prompt: string, p: Palette): string {
  switch (t) {
    case "cityscape": return cityscapeSvg(h, p);
    case "civic":     return civicSvg(h, p);
    case "markets":   return marketsSvg(h, p);
    case "policy":    return policySvg(h, p);
    case "world":     return worldSvg(h, p);
    case "data-hall": return dataHallSvg(h, p);
    case "masthead":  return mastheadSvg(h, p, prompt);
  }
}

// ─── Cityscape (financial district at blue hour) ────────────────────────────

function cityscapeSvg(h: number, p: Palette): string {
  // Two layers of building silhouettes, distant (paler, atmospheric) and
  // foreground (full ink). Each is a deterministic sequence of rectangles
  // with varying widths/heights. Lit window grid on the foreground layer.

  function buildings(rowSeed: number, baseY: number, baseColor: string, opacity: number, withWindows: boolean): string {
    let x = 0;
    let parts = "";
    let i = 0;
    while (x < 1600) {
      const seed = (rowSeed + i * 41) % 1000;
      const w = 70 + (seed % 90);
      const buildingH = 80 + ((seed * 17) % 280);
      const y = baseY - buildingH;
      parts += `<rect x="${x}" y="${y}" width="${w - 8}" height="${buildingH}" fill="${baseColor}" fill-opacity="${opacity}"/>`;
      // Roof aerial, random tiny mast.
      if (seed % 3 === 0) {
        parts += `<line x1="${x + w / 2 - 4}" y1="${y}" x2="${x + w / 2 - 4}" y2="${y - 12}" stroke="${baseColor}" stroke-opacity="${opacity * 0.7}" stroke-width="1.5"/>`;
      }
      if (withWindows) {
        // Window grid, 4-6 columns, every other row lit.
        const cols = 3 + (seed % 4);
        const rows = Math.floor(buildingH / 22);
        for (let c = 0; c < cols; c++) {
          for (let r = 1; r < rows; r++) {
            const lit = (seed + c * 7 + r * 13) % 5 < 2;
            const wx = x + 6 + c * ((w - 16) / cols);
            const wy = y + r * 22;
            const ww = (w - 16) / cols - 4;
            const wh = 9;
            const fill = lit ? p.warm : "hsl(0,0%,8%)";
            const alpha = lit ? 0.55 + ((seed + c + r) % 3) * 0.12 : 0.18;
            parts += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${fill}" fill-opacity="${alpha}"/>`;
          }
        }
      }
      x += w;
      i++;
    }
    return parts;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <linearGradient id="streetLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.warm}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${p.warm}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>
    <rect width="1600" height="800" fill="url(#sun)"/>

    <!-- Distant skyline, hazed. -->
    <g filter="url(#atmos)">
      ${buildings(h, 600, p.ink, 0.55, false)}
    </g>
    <!-- Atmospheric horizon haze. -->
    <rect x="0" y="540" width="1600" height="100" fill="url(#haze)"/>

    <!-- Mid skyline. -->
    ${buildings(h * 3 + 7, 680, p.ink, 0.75, false)}

    <!-- Foreground skyline with lit windows. -->
    ${buildings(h * 7 + 13, 800, p.bottom, 1, true)}

    <!-- Street light wash. -->
    <rect x="0" y="700" width="1600" height="100" fill="url(#streetLight)"/>

    <!-- Subtle skyline contour highlight. -->
    <line x1="0" y1="540" x2="1600" y2="540" stroke="${p.warm}" stroke-opacity="0.06"/>

    <!-- Coordinate corner labels. -->
    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">33.86°S · 151.20°E</text>
      <text x="60" y="760">SYDNEY · 18:42 AEST</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── Civic dome at dusk ─────────────────────────────────────────────────────

function civicSvg(h: number, p: Palette): string {
  // Parliament-style dome silhouette with columns, dramatic backlight,
  // rim of sky above. Light shafts radiate from behind the dome.

  // Flagpole on top, deterministic but rotates slightly.
  const flagSway = ((h % 7) - 3) * 0.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <radialGradient id="dome-glow" cx="50%" cy="60%" r="40%">
        <stop offset="0%" stop-color="${p.warm}" stop-opacity="0.6"/>
        <stop offset="60%" stop-color="${p.warm}" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="${p.warm}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>
    <rect width="1600" height="800" fill="url(#sun)"/>

    <!-- Light shafts behind the dome. -->
    <g opacity="0.55">
      ${Array.from({ length: 9 }).map((_, i) => {
        const angle = -60 + i * 15;
        const cx = 800;
        const cy = 460;
        return `<g transform="translate(${cx} ${cy}) rotate(${angle})">
          <rect x="0" y="-260" width="3" height="260" fill="${p.warm}" fill-opacity="0.04" filter="url(#atmos)"/>
        </g>`;
      }).join("")}
    </g>
    <circle cx="800" cy="460" r="240" fill="url(#dome-glow)"/>

    <!-- Steps. -->
    <g fill="${p.ink}">
      <rect x="240" y="660" width="1120" height="6" fill-opacity="0.8"/>
      <rect x="220" y="680" width="1160" height="6" fill-opacity="0.75"/>
      <rect x="200" y="700" width="1200" height="6" fill-opacity="0.7"/>
      <rect x="180" y="720" width="1240" height="6" fill-opacity="0.65"/>
      <rect x="160" y="740" width="1280" height="6" fill-opacity="0.6"/>
    </g>
    <rect x="0" y="660" width="1600" height="140" fill="${p.bottom}" fill-opacity="0.5"/>

    <!-- Architrave above the columns. -->
    <rect x="300" y="540" width="1000" height="22" fill="${p.ink}"/>
    <!-- Frieze highlight (warm rim from setting sun). -->
    <rect x="300" y="540" width="1000" height="2" fill="${p.warm}" fill-opacity="0.55"/>

    <!-- Columns. -->
    <g fill="${p.ink}">
      ${Array.from({ length: 8 }).map((_, i) => {
        const x = 340 + i * 130;
        return `<rect x="${x}" y="562" width="30" height="100"/>
                <rect x="${x - 6}" y="558" width="42" height="6"/>
                <rect x="${x - 6}" y="660" width="42" height="6"/>`;
      }).join("")}
    </g>
    <!-- Column rim highlights. -->
    <g fill="${p.warm}" fill-opacity="0.35">
      ${Array.from({ length: 8 }).map((_, i) => {
        const x = 340 + i * 130;
        return `<rect x="${x}" y="562" width="2" height="100"/>`;
      }).join("")}
    </g>

    <!-- Dome. -->
    <ellipse cx="800" cy="540" rx="170" ry="160" fill="${p.ink}"/>
    <ellipse cx="780" cy="500" rx="100" ry="120" fill="${p.warm}" fill-opacity="0.08" filter="url(#atmos)"/>
    <!-- Dome rim highlight. -->
    <path d="M 630 540 Q 800 380 970 540" stroke="${p.warm}" stroke-opacity="0.45" stroke-width="1.5" fill="none"/>
    <!-- Drum below the dome. -->
    <rect x="700" y="500" width="200" height="50" fill="${p.ink}"/>
    <!-- Drum windows lit. -->
    ${Array.from({ length: 5 }).map((_, i) => {
      const x = 712 + i * 38;
      return `<rect x="${x}" y="514" width="14" height="24" fill="${p.warm}" fill-opacity="0.55"/>`;
    }).join("")}

    <!-- Cupola spike. -->
    <line x1="800" y1="380" x2="800" y2="340" stroke="${p.ink}" stroke-width="6"/>
    <circle cx="800" cy="335" r="6" fill="${p.ink}"/>

    <!-- Flagpole + flag. -->
    <line x1="800" y1="340" x2="800" y2="280" stroke="${p.ink}" stroke-width="2"/>
    <g transform="translate(800 285) rotate(${flagSway})">
      <path d="M0 0 L 36 4 L 32 16 L 0 20 Z" fill="${p.accent}" fill-opacity="0.65"/>
    </g>

    <!-- Foreground ink wash. -->
    <rect x="0" y="745" width="1600" height="55" fill="${p.bottom}"/>

    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">CANBERRA · 17:02 AEST</text>
      <text x="60" y="760">CIVIC DESK</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── Markets (screens + tickers, depth-of-field) ────────────────────────────

function marketsSvg(h: number, p: Palette): string {
  // Foreground out-of-focus glow orbs + sharp ticker board mid-frame.
  // Tickers are deterministic but vary slightly per edition.

  const tickers = ["ASX 200", "AUD/USD", "10Y AGB", "BHP", "CBA", "NAB", "WBC", "BTC", "GOLD", "WTI"];
  const tickerRows = Array.from({ length: 12 }).map((_, i) => {
    const seed = (h + i * 23) % 1000;
    const sym = tickers[i % tickers.length];
    const value = ((seed % 8000) / 10).toFixed(2);
    const pct = (((seed % 200) - 100) / 100).toFixed(2);
    const up = Number(pct) >= 0;
    return { sym, value, pct, up };
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <filter id="bokeh"><feGaussianBlur stdDeviation="22"/></filter>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>

    <!-- Far depth: blurred bokeh orbs. -->
    <g filter="url(#bokeh)" opacity="0.7">
      ${Array.from({ length: 14 }).map((_, i) => {
        const seed = (h + i * 47) % 1000;
        const x = (seed * 7) % 1600;
        const y = 100 + ((seed * 13) % 600);
        const r = 30 + (seed % 50);
        const colour = i % 3 === 0 ? p.warm : i % 3 === 1 ? p.cool : p.accent;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}" fill-opacity="0.22"/>`;
      }).join("")}
    </g>

    <!-- Ticker board (centred panel). -->
    <g transform="translate(380 220)">
      <rect x="0" y="0" width="840" height="380" fill="${p.ink}" fill-opacity="0.92" stroke="${p.warm}" stroke-opacity="0.2"/>
      <!-- Header strip. -->
      <rect x="0" y="0" width="840" height="36" fill="${p.warm}" fill-opacity="0.08"/>
      <text x="20" y="24" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="3" fill="${p.warm}" fill-opacity="0.8">LIVE MARKETS · ASX</text>
      <text x="820" y="24" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="2" fill="${p.warm}" fill-opacity="0.55">07:00 AEST</text>

      <!-- Rows. -->
      ${tickerRows.map((r, i) => {
        const y = 60 + i * 27;
        const tone = r.up ? "hsl(155, 70%, 65%)" : "hsl(0, 70%, 65%)";
        return `
          <line x1="20" y1="${y + 14}" x2="820" y2="${y + 14}" stroke="${p.warm}" stroke-opacity="0.08"/>
          <text x="20" y="${y + 6}" font-family="JetBrains Mono, monospace" font-size="13" fill="${p.warm}" fill-opacity="0.85">${r.sym}</text>
          <text x="500" y="${y + 6}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="13" fill="${p.warm}" fill-opacity="0.85">${r.value}</text>
          <text x="800" y="${y + 6}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="13" fill="${tone}" fill-opacity="0.9">${r.up ? "▲" : "▼"} ${r.up ? "+" : ""}${r.pct}%</text>
        `;
      }).join("")}
    </g>

    <!-- Headline tile bottom-left. -->
    <g transform="translate(120 620)">
      <rect width="380" height="100" fill="${p.ink}" fill-opacity="0.86" stroke="${p.warm}" stroke-opacity="0.18"/>
      <text x="20" y="34" font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="3" fill="${p.warm}" fill-opacity="0.55">10Y AUSTRALIAN BOND</text>
      <text x="20" y="78" font-family="Playfair Display, serif" font-weight="700" font-size="46" fill="${p.warm}">4.21<tspan font-size="22" font-weight="500" fill-opacity="0.6">%</tspan></text>
    </g>

    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">MARKETS DESK · LIVE</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── Policy (parliament steps, directional light) ───────────────────────────

function policySvg(h: number, p: Palette): string {
  // Tall columns receding to a vanishing point, warm hallway light.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.warm}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${p.warm}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${p.warm}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>
    <rect width="1600" height="800" fill="url(#sun)"/>

    <!-- Receding floor. -->
    <polygon points="0,800 1600,800 1100,500 500,500" fill="${p.ink}" fill-opacity="0.85"/>
    <!-- Floor highlight pool. -->
    <polygon points="600,800 1000,800 900,600 700,600" fill="${p.warm}" fill-opacity="0.06" filter="url(#atmos)"/>

    <!-- Vanishing-point columns. -->
    <g fill="${p.ink}" fill-opacity="0.95">
      ${Array.from({ length: 5 }).map((_, i) => {
        const t = i / 4;
        const xLeft = 100 + t * 400;
        const xRight = 1500 - t * 400;
        const colW = 60 - t * 36;
        const top = 200 + t * 200;
        const bot = 800 - t * 200;
        return `
          <rect x="${xLeft}" y="${top}" width="${colW}" height="${bot - top}"/>
          <rect x="${xLeft - colW * 0.15}" y="${top}" width="${colW * 1.3}" height="${colW * 0.4}"/>
          <rect x="${xLeft - colW * 0.15}" y="${bot - colW * 0.4}" width="${colW * 1.3}" height="${colW * 0.4}"/>
          <rect x="${xRight - colW}" y="${top}" width="${colW}" height="${bot - top}"/>
          <rect x="${xRight - colW * 1.15}" y="${top}" width="${colW * 1.3}" height="${colW * 0.4}"/>
          <rect x="${xRight - colW * 1.15}" y="${bot - colW * 0.4}" width="${colW * 1.3}" height="${colW * 0.4}"/>
        `;
      }).join("")}
    </g>
    <!-- Warm rim on closest columns. -->
    <g fill="${p.warm}" fill-opacity="0.32">
      <rect x="100" y="200" width="3" height="600"/>
      <rect x="1497" y="200" width="3" height="600"/>
    </g>

    <!-- Light shafts from the right-rear arches. -->
    <g>
      <rect x="700" y="200" width="60" height="500" fill="url(#shaft)" filter="url(#atmos)"/>
      <rect x="840" y="200" width="60" height="500" fill="url(#shaft)" filter="url(#atmos)"/>
    </g>

    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">POLICY DESK · CANBERRA</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── World (earth at night, illuminated coastlines) ─────────────────────────

function worldSvg(h: number, p: Palette): string {
  const cx = 1100;
  const cy = 400;
  const r = 320;

  // Coastline-style polylines on the sphere.
  const continents = [
    "M260,250 L320,205 L420,200 L500,235 L520,295 L495,355 L440,380 L385,420 L325,440 L265,425 L235,365 L235,305 Z",
    "M380,460 L430,460 L470,530 L450,620 L415,675 L385,680 L355,635 L350,560 L365,500 Z",
    "M730,210 L800,220 L850,255 L835,295 L770,300 L735,275 Z",
    "M780,310 L860,310 L895,375 L880,485 L825,570 L795,580 L760,525 L750,425 L765,360 Z",
    "M860,200 L1080,210 L1190,250 L1230,315 L1190,365 L1080,375 L960,365 L890,315 L860,260 Z",
    "M1170,520 L1260,520 L1310,555 L1280,595 L1200,600 L1170,575 Z",
  ];

  function projectToSphere(d: string): string {
    // No real projection, just shift to centre the continents on the
    // visible sphere face and rotate slightly.
    return d;
  }

  const hotspots = [
    [1248, 568, 1.0, "SYD"],
    [438, 297, 0.65, "NYC"],
    [800, 250, 0.55, "LON"],
    [1080, 290, 0.5, "TKO"],
    [820, 470, 0.4, "JNB"],
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <radialGradient id="earth" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="hsl(225, 50%, 18%)"/>
        <stop offset="60%" stop-color="hsl(225, 60%, 8%)"/>
        <stop offset="100%" stop-color="hsl(225, 70%, 3%)"/>
      </radialGradient>
      <radialGradient id="rim" cx="50%" cy="50%" r="50%">
        <stop offset="92%" stop-color="${p.cool}" stop-opacity="0"/>
        <stop offset="98%" stop-color="${p.cool}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${p.cool}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="terminator" cx="20%" cy="50%" r="55%">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.65"/>
      </radialGradient>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>

    <!-- Subtle starfield. -->
    <g fill="${p.warm}">
      ${Array.from({ length: 30 }).map((_, i) => {
        const seed = (h + i * 91) % 1000;
        const x = (seed * 7) % 1100;
        const y = (seed * 13) % 800;
        const r2 = 0.5 + (seed % 3) * 0.4;
        const op = 0.15 + (seed % 5) * 0.06;
        return `<circle cx="${x}" cy="${y}" r="${r2}" fill-opacity="${op}"/>`;
      }).join("")}
    </g>

    <!-- Earth body. -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#earth)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="url(#rim)"/>

    <!-- Continent outlines, clipped to the visible face. -->
    <g transform="translate(${cx - 800} ${cy - 400}) scale(0.86)" opacity="0.85">
      <g fill="hsl(225, 50%, 16%)" stroke="${p.warm}" stroke-opacity="0.3" stroke-width="0.8">
        ${continents.map((d) => `<path d="${projectToSphere(d)}"/>`).join("")}
      </g>
      <!-- Illuminated coastlines, bright amber edge to suggest city lights. -->
      <g fill="none" stroke="${p.warm}" stroke-opacity="0.55" stroke-width="1.2">
        ${continents.map((d) => `<path d="${projectToSphere(d)}"/>`).join("")}
      </g>
    </g>

    <!-- City-light dots scattered along coastlines (deterministic). -->
    <g fill="${p.warm}">
      ${Array.from({ length: 60 }).map((_, i) => {
        const seed = (h + i * 53) % 1000;
        const angle = ((seed * 11) % 360) * (Math.PI / 180);
        const rr = r * (0.5 + ((seed * 17) % 100) / 220);
        const x = cx + Math.cos(angle) * rr;
        const y = cy + Math.sin(angle) * rr;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r * 0.95) return "";
        return `<circle cx="${x}" cy="${y}" r="${0.8 + (seed % 4) * 0.3}" fill-opacity="${0.4 + (seed % 5) * 0.1}"/>`;
      }).join("")}
    </g>

    <!-- Terminator shadow on the far side. -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#terminator)"/>

    <!-- Major hotspots. -->
    ${hotspots.map(([x, y, mag, label]) => {
      const m = mag as number;
      return `
        <circle cx="${x}" cy="${y}" r="${4 + m * 3}" fill="${p.accent}" fill-opacity="${0.85 * m}"/>
        <circle cx="${x}" cy="${y}" r="${14 + m * 14}" fill="none" stroke="${p.accent}" stroke-opacity="${0.4 * m}"/>
        <text x="${(x as number) + 16}" y="${(y as number) + 4}" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" fill="${p.accent}" fill-opacity="${0.7 * m}">${label}</text>
      `;
    }).join("")}

    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">GLOBAL DESK · ${new Date().toISOString().slice(11, 16)} UTC</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── Data hall (server corridor, vanishing point) ───────────────────────────

function dataHallSvg(h: number, p: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}
      <linearGradient id="rack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.ink}"/>
        <stop offset="100%" stop-color="hsl(0,0%,2%)"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="800" fill="url(#sky)"/>

    <!-- Receding floor / ceiling. -->
    <polygon points="0,0 1600,0 900,400 700,400" fill="${p.bottom}" fill-opacity="0.85"/>
    <polygon points="0,800 1600,800 900,400 700,400" fill="${p.bottom}" fill-opacity="0.95"/>

    <!-- Receding rack rows. -->
    ${Array.from({ length: 7 }).map((_, i) => {
      const t = i / 6;
      const xLeft = 30 + t * 660;
      const xRight = 1570 - t * 660;
      const yTop = 200 + t * 200;
      const yBot = 720 - t * 200;
      const rackH = yBot - yTop;
      const ledRows = Math.max(4, Math.floor(rackH / 16));
      // LED row colours alternate cool/amber.
      const leds = Array.from({ length: ledRows })
        .map((__, j) => {
          const seed = (h + i * 13 + j * 41) % 100;
          const on = seed > 30;
          if (!on) return "";
          const colour = (seed + j) % 4 === 0 ? p.warm : p.cool;
          return `
            <rect x="${xLeft + 4}" y="${yTop + 4 + j * 16}" width="${(xRight - xLeft) * 0.04}" height="3" fill="${colour}" fill-opacity="${0.7 - t * 0.6}"/>
            <rect x="${xRight - (xRight - xLeft) * 0.04 - 4}" y="${yTop + 4 + j * 16}" width="${(xRight - xLeft) * 0.04}" height="3" fill="${colour}" fill-opacity="${0.7 - t * 0.6}"/>
          `;
        })
        .join("");

      return `
        <rect x="${xLeft}" y="${yTop}" width="${(xRight - xLeft) * 0.08}" height="${rackH}" fill="url(#rack)" fill-opacity="${1 - t * 0.65}"/>
        <rect x="${xRight - (xRight - xLeft) * 0.08}" y="${yTop}" width="${(xRight - xLeft) * 0.08}" height="${rackH}" fill="url(#rack)" fill-opacity="${1 - t * 0.65}"/>
        ${leds}
      `;
    }).join("")}

    <!-- Floor light strip. -->
    <polygon points="700,400 900,400 1000,800 600,800" fill="${p.cool}" fill-opacity="0.06" filter="url(#atmos)"/>

    <!-- Vanishing-point glow. -->
    <circle cx="800" cy="400" r="120" fill="${p.warm}" fill-opacity="0.15" filter="url(#atmos)"/>

    <g font-family="JetBrains Mono, monospace" fill="${p.accent}" fill-opacity="0.4" font-size="11" letter-spacing="2">
      <text x="60" y="740">TECH DESK · AP-SOUTHEAST-2</text>
    </g>

    ${commonFinish(p)}
  </svg>`;
}

// ─── Masthead (oversized typographic spread) ────────────────────────────────

function mastheadSvg(h: number, p: Palette, prompt: string): string {
  const editionMatch = prompt.match(/Edition\s+(\d+)/i);
  const editionNum = editionMatch ? editionMatch[1] : String(10 + (h % 90));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
    <defs>${commonDefs(p, h)}</defs>
    <rect width="1600" height="800" fill="url(#sky)"/>
    <rect width="1600" height="800" fill="url(#sun)"/>

    <!-- Top + bottom paper rules. -->
    <line x1="80" y1="170" x2="1520" y2="170" stroke="${p.warm}" stroke-opacity="0.65"/>
    <line x1="80" y1="176" x2="1520" y2="176" stroke="${p.warm}" stroke-opacity="0.2"/>

    <!-- Slug row. -->
    <text x="80" y="210" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="6" fill="${p.warm}" fill-opacity="0.7">EDITION No. ${editionNum}</text>
    <text x="1520" y="210" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="6" fill="${p.warm}" fill-opacity="0.7">SYDNEY · 7AM AEST</text>

    <!-- Wordmark, outlined behind, solid in front. -->
    <text x="800" y="490" text-anchor="middle" font-family="Playfair Display, serif" font-weight="800" font-size="220" letter-spacing="-10" fill="none" stroke="${p.warm}" stroke-opacity="0.18" stroke-width="2">The Desk</text>
    <text x="800" y="480" text-anchor="middle" font-family="Playfair Display, serif" font-weight="800" font-size="220" letter-spacing="-10" fill="${p.warm}" fill-opacity="0.92">The Desk</text>

    <!-- Tagline. -->
    <line x1="80" y1="600" x2="1520" y2="600" stroke="${p.warm}" stroke-opacity="0.4"/>
    <line x1="80" y1="606" x2="1520" y2="606" stroke="${p.warm}" stroke-opacity="0.12"/>
    <text x="800" y="660" text-anchor="middle" font-family="Playfair Display, serif" font-style="italic" font-size="30" fill="${p.warm}" fill-opacity="0.78">Intelligence for property partnerships</text>
    <text x="800" y="710" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="6" fill="${p.warm}" fill-opacity="0.45">BY RUBEN LAUBSCHER</text>

    ${commonFinish(p)}
  </svg>`;
}
