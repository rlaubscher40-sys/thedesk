import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { loadAsset } from "../og/instagramCards";
import type { DocumentaryStory } from "./documentaryStory";
import type { MeasuredPhrase } from "./phraseSpeech";
import { TRIGUBOFF_FINANCIAL_FACTS as facts } from "../../shared/documentaryReels";
import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";

/** Authored documentary sequences. Archive images retain dates and credits.
 * Diagrams explain recorded events; no invented archive documents or cash transfers. */
export const PERSON_DOCUMENTARY_ASSETS = {
  portrait: {
    file: DOCUMENTARY_PHOTOS.triguboffArchive.asset,
    sha256: DOCUMENTARY_PHOTOS.triguboffArchive.sha256,
  },
  tower: {
    file: DOCUMENTARY_PHOTOS.worldTowerArchive.asset,
    sha256: DOCUMENTARY_PHOTOS.worldTowerArchive.sha256,
  },
  accommodation: {
    file: DOCUMENTARY_PHOTOS.meritonArchive.asset,
    sha256: DOCUMENTARY_PHOTOS.meritonArchive.sha256,
  },
  coast: {
    file: DOCUMENTARY_PHOTOS.goldCoastArchive.asset,
    sha256: DOCUMENTARY_PHOTOS.goldCoastArchive.sha256,
  },
  map: { file: DOCUMENTARY_PHOTOS.tianjinMap.asset, sha256: DOCUMENTARY_PHOTOS.tianjinMap.sha256 },
} as const;

export async function createPersonDocumentaryRenderer(
  story: DocumentaryStory,
  scenes: Array<{ key: string; start: number; seconds: number; phrases: MeasuredPhrase[] }>,
  total: number
) {
  if (story.id !== "triguboff-apartments" || story.treatment !== "person-led-v2")
    throw new Error("Person-led treatment needs its authored Triguboff episode.");
  for (const [file, name] of [
    ["PlayfairDisplay-Bold.woff", "DocTitle"],
    ["DeskEditorialSans-Regular.woff", "DocBody"],
    ["JetBrainsMono-Regular.woff", "DocMono"],
  ]) {
    const data = await loadAsset(file!);
    if (!data || !GlobalFonts.register(Buffer.from(data.split(",")[1]!, "base64"), name!))
      throw new Error("Documentary typography unavailable.");
  }
  const images = {} as Record<keyof typeof PERSON_DOCUMENTARY_ASSETS, Image>;
  for (const [key, asset] of Object.entries(PERSON_DOCUMENTARY_ASSETS)) {
    const data = await loadAsset(asset.file);
    if (!data) throw new Error(`Documentary asset missing: ${asset.file}`);
    const bytes = Buffer.from(data.split(",")[1]!, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
      throw new Error(`Documentary asset changed: ${asset.file}`);
    images[key as keyof typeof images] = await loadImage(bytes);
  }
  const canvas = createCanvas(1080, 1920),
    c = canvas.getContext("2d");
  const ink = "#111714",
    paper = "#eee9da",
    gold = "#d9b57a",
    muted = "#a6afa6",
    green = "#8ac4a0",
    red = "#e08b79";
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (v: number) => 1 - (1 - clamp(v)) ** 3;
  const txt = (
    s: string,
    x: number,
    y: number,
    size = 26,
    color = muted,
    font = "DocMono",
    maxWidth = 840
  ) => {
    c.fillStyle = color;
    c.font = `${size}px ${font}`;
    while (c.measureText(s).width > maxWidth && size > 16) {
      size -= 1;
      c.font = `${size}px ${font}`;
    }
    c.fillText(s, x, y);
  };
  const title = (ss: string[], x = 84, y = 330, size = 82, color = paper, max = 840) =>
    ss.forEach((s, i) => txt(s, x, y + i * size * 1.12, size, color, "DocTitle", max));
  const line = (x: number, y: number, xx: number, yy: number, color = gold, width = 2) => {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  };
  const dot = (x: number, y: number, r = 9, color = gold) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  };
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);
    }
  };
  const photo = (
    img: Image,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom = 1,
    fx = 0.5,
    fy = 0.5
  ) => {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    const s = Math.max(w / img.width, h / img.height) * zoom;
    c.drawImage(
      img,
      x + (w - img.width * s) * fx,
      y + (h - img.height * s) * fy,
      img.width * s,
      img.height * s
    );
    c.restore();
  };
  const shade = (a: number, b: number, opacity = 1) => {
    const g = c.createLinearGradient(0, a, 0, b);
    g.addColorStop(0, "rgba(17,23,20,0)");
    g.addColorStop(1, `rgba(17,23,20,${opacity})`);
    c.fillStyle = g;
    c.fillRect(0, a, 1080, b - a);
  };
  const heading = (s: string) => txt(s, 84, 210, 26, gold);
  const note = (s: string, y = 1235, color = gold) => txt(s, 84, y, 33, color, "DocBody");
  const aud = (v: number) => `A$${Math.round(v).toLocaleString("en-AU")}`;
  const reveal = (e: number, at: number, fn: () => void) => {
    c.save();
    c.globalAlpha = ease((e - at) / 0.7);
    c.translate(0, 14 * (1 - c.globalAlpha));
    fn();
    c.restore();
  };
  const house = (x: number, y: number, scale: number, p: number) => {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    const pts = [
      [0, 110],
      [150, 0],
      [300, 110],
      [300, 310],
      [0, 310],
      [0, 110],
    ];
    for (let i = 1; i < pts.length; i++) {
      const z = ease(p * 5 - (i - 1));
      line(
        pts[i - 1]![0]!,
        pts[i - 1]![1]!,
        pts[i - 1]![0]! + (pts[i]![0]! - pts[i - 1]![0]!) * z,
        pts[i - 1]![1]! + (pts[i]![1]! - pts[i - 1]![1]!) * z,
        paper,
        5
      );
    }
    if (p > 0.5) {
      rect(35, 145, 65, 65, "#334a40", gold);
      rect(180, 160, 65, 150, "#334a40", gold);
    }
    c.restore();
  };
  const tower = (x: number, base: number, w: number, levels: number, p: number, color = gold) => {
    const h = levels * 12;
    rect(x, base - h, w, h, "#1a2620", "#526056");
    c.save();
    c.beginPath();
    c.rect(x, base - h * ease(p), w, h * ease(p));
    c.clip();
    for (let i = 0; i < levels; i++) {
      line(x + 8, base - i * 12 - 6, x + w - 8, base - i * 12 - 6, color, 3);
    }
    c.restore();
  };
  const source = [
    "MERITON / FOUNDER PROFILE",
    "FORBES AUSTRALIA / 2024",
    "FORBES / 2024 + DOMAIN / 2018",
    "MERITON / 2013 + NATIONAL ARCHIVES",
    "MERITON / 2013 + PROPERTY COUNCIL",
    "DOMAIN / 21 AUGUST 2018",
    "DOMAIN / 2018 + FORBES / 2024",
    "URBAN.COM.AU / 20 APRIL 2023",
    "FORBES / 2024 + MERITON / 2025",
    "FEDERAL COURT / [2006] FCA 1553",
    "JBW SURVEYORS / PROJECT ACCOUNT",
    "MERITON SUITES / COMPANY HISTORY",
    "URBAN TASKFORCE / 2009 AWARD PROFILE",
    "THE BUSINESS TIMES / 13 FEBRUARY 2014",
    "APARTMENTS.COM.AU / FY2020 ACCOUNTS REPORT",
    "MERITON / CHECKED 14 SEPTEMBER 2026",
  ];
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside documentary timeline.");
    const scene = scenes.findLast((s) => s.start <= time)!;
    const idx = scenes.indexOf(scene),
      local = time - scene.start;
    const split = scene.phrases[1]?.start ?? scene.seconds,
      beat = local >= split ? 1 : 0;
    const e = local - (beat ? split : 0),
      duration = beat ? scene.seconds - split : split,
      p = clamp(e / Math.max(0.1, duration)),
      shot = idx * 2 + beat;
    c.globalAlpha = 1;
    rect(0, 0, 1080, 1920, ink);
    let credit = "ORIGINAL DIAGRAM / ILLUSTRATIVE";
    // Fine static film texture. Deterministic and stationary, avoiding crawling compression noise.
    c.globalAlpha = 0.1;
    for (let i = 0; i < 620; i++) {
      const x = (i * 397) % 1080,
        y = (i * 631) % 1420;
      rect(x, y, 1 + (i % 2), 1, paper);
    }
    c.globalAlpha = 1;
    if (shot === 0) {
      photo(images.portrait, 0, 0, 1080, 1330, 1.82 + p * 0.07, 0.53, 0.56);
      shade(720, 1340);
      rect(0, 0, 1080, 240, "rgba(17,23,20,.60)");
      heading("THE PERSON BEHIND MERITON");
      title(["Harry", "Triguboff."], 84, 925, 110);
      note("Before the towers.", 1220);
      credit = "PORTRAIT: MERITON / 2008 / PUBLIC DOMAIN";
    } else if (shot === 1) {
      photo(images.map, 360, 280, 660, 1020, 1 + p * 0.08, 0.52, 0.4);
      rect(62, 280, 475, 1020, "rgba(17,23,20,.94)");
      heading("1933–1948 / THE JOURNEY");
      title(["From China", "to Sydney."], 84, 345, 71);
      const places = [
        ["DALIAN", "1933 / BORN"],
        ["TIANJIN", "CHILDHOOD"],
        ["SYDNEY", "1948 / WITH HIS BROTHER"],
      ];
      for (let i = 0; i < 3; i++) {
        const y = 650 + i * 220;
        reveal(e, i * duration * 0.26, () => {
          if (i) line(114, y - 205, 114, y - 22, "#687669");
          dot(114, y);
          txt(places[i]![0]!, 148, y + 10, 31, paper);
          txt(places[i]![1]!, 148, y + 57, 20, gold, undefined, 355);
        });
      }
      credit = "TIANJIN MAP: NIKKODO / 1930 / GEOGRAPHICUS / PD";
    } else if (shot === 2) {
      heading("FINDING HIS DIRECTION");
      title(["A winding road", "into property."], 84, 340, 72);
      const places = ["LEEDS", "ISRAEL", "SOUTH AFRICA"];
      for (let i = 0; i < 3; i++) {
        const y = 610 + i * 135;
        reveal(e, i * 0.7, () => {
          dot(110, y, 7);
          txt(places[i]!, 145, y + 10, 31, paper);
          if (i < 2) line(110, y + 20, 110, y + 105, "#586459");
        });
      }
      reveal(e, 2, () => {
        txt("TEXTILES", 145, 1040, 24, gold);
      });
      const q = ease((p - 0.37) / 0.2);
      if (q > 0) {
        c.save();
        c.globalAlpha = q;
        rect(550, 540, 390, 600, ink);
        house(595, 690, 0.8, ease((p - 0.5) / 0.25));
        txt("ROSEVILLE", 570, 600, 29, gold);
        txt("TAKES OVER", 590, 1050, 25, paper);
        txt("COMPLETION", 590, 1090, 25, paper);
        c.restore();
      }
      note("Taxis. A milk round. His own home.", 1220);
    } else if (shot === 3) {
      heading("1963 / TEMPE");
      title(["The first eight."], 84, 345, 90);
      txt("LAND", 84, 490, 27, gold);
      title([aud(facts.tempe.landAud * ease(e / 1.2))], 84, 590, 94);
      const unit = ease((p - 0.18) / 0.28);
      for (let i = 0; i < 8; i++) {
        const x = 90 + (i % 4) * 205,
          y = 750 + Math.floor(i / 4) * 135;
        rect(x, y, 180, 110, i < unit * 8 ? "#344b3c" : "#19251e", i < unit * 8 ? gold : "#455148");
        if (i < unit * 8) {
          txt(String(i + 1).padStart(2, "0"), x + 20, y + 70, 32, paper);
        }
      }
      if (p > 0.47) {
        reveal(e, duration * 0.47, () => {
          txt("GROSS BLOCK SALE / WITHIN 8 MONTHS", 84, 1115, 25, gold);
          title([aud(facts.tempe.saleAud * ease((p - 0.47) / 0.12))], 84, 1220, 97);
        });
      }
      credit = "HISTORICAL AUD EQUIVALENTS / NOT INFLATION-ADJUSTED";
    } else if (shot === 4) {
      heading("1960s / GLADESVILLE");
      title(["18 apartments."], 84, 345, 88);
      txt("MERITON STREET", 84, 425, 30, gold);
      const spread = ease((p - 0.4) / 0.35);
      for (let i = 0; i < 18; i++) {
        const x = 100 + (i % 6) * (127 + spread * 11),
          y = 620 + Math.floor(i / 6) * (126 + spread * 18);
        rect(x, y, 121 - spread * 8, 120 - spread * 10, "#293b30", paper);
        txt(String(i + 1).padStart(2, "0"), x + 32, y + 73, 25, gold);
      }
      reveal(e, duration * 0.4, () => {
        txt("ONE BLOCK", 84, 1130, 25, muted);
        line(84, 1145, 250, 1145, red, 3);
        note("Individual apartment sales.", 1220);
      });
      credit = "18 UNITS / COMPANY HISTORY DATES PROJECT TO 1968";
    } else if (shot === 5) {
      heading("1969–1974 / CONTROL AND RISK");
      title(["Public.", "Private again."], 84, 345, 88);
      const cx = 515,
        cy = 850,
        r = 215;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.strokeStyle = "#526355";
      c.lineWidth = 2;
      c.stroke();
      const consolidate = ease((p - 0.3) / 0.36);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        dot(
          cx + Math.sin(a) * r * (1 - consolidate),
          cy + Math.cos(a) * r * (1 - consolidate),
          12,
          gold
        );
      }
      if (consolidate > 0.3) {
        c.save();
        c.globalAlpha = ease((consolidate - 0.3) / 0.6);
        c.beginPath();
        c.arc(cx, cy, 175, 0, Math.PI * 2);
        c.clip();
        photo(images.portrait, cx - 180, cy - 180, 360, 360, 2.8, 0.53, 0.46);
        c.restore();
      }
      if (consolidate > 0.95) txt("HARRY / CONTROL", cx - 140, cy + 280, 27, paper);
      txt("1969 / FLOAT", 84, 1175, 27, muted);
      txt("1973 / BUYBACK", 550, 1175, 27, gold, undefined, 370);
      if (p > 0.82) {
        rect(0, 1210, 1080, 82, "#3a2420");
        txt("1974 / THE MARKET TURNS", 84, 1263, 28, red);
      }
      credit = "OWNERSHIP DIAGRAM / PORTRAIT: MERITON, 2008 / PD";
    } else if (shot === 6) {
      heading("1974–75 / THE PROPERTY CRASH");
      title(["A$30 million."], 84, 390, 106, red);
      txt("REPORTED DEBT", 84, 465, 28, paper);
      for (let i = 0; i < 30; i++) {
        const x = 92 + (i % 6) * 138,
          y = 610 + Math.floor(i / 6) * 82;
        rect(x, y, 110, 57, "#2b3028", i < 10 ? red : "#5a6157");
      }
      txt("UNSOLD APARTMENTS", 84, 1100, 28, muted);
      reveal(e, duration * 0.55, () => {
        line(84, 1150, 924, 1150, "#59635a");
        txt("1976", 84, 1240, 60, paper);
        txt("DEBT REPAID", 360, 1230, 32, green);
      });
      credit = "REPORTED HISTORY / REPAYMENT SOURCES NOT ITEMISED";
    } else if (shot === 7) {
      photo(images.coast, 0, 280, 1080, 1060, 1.03 + p * 0.08, 0.58, 0.5);
      rect(0, 280, 1080, 150, "rgba(17,23,20,.60)");
      shade(850, 1320);
      heading("1980s–1990s / QUEENSLAND");
      title(["Beyond Sydney."], 84, 360, 84);
      const names = [
        ["FLORIDA", "SURFERS PARADISE"],
        ["THE NELSON", "PARADISE WATERS"],
        ["XANADU", "LATE 1990s"],
      ];
      for (let i = 0; i < 3; i++) {
        reveal(e, i * duration * 0.23, () => {
          const y = 830 + i * 154;
          rect(64, y - 49, 860, 115, "rgba(17,23,20,.87)");
          txt(names[i]![0]!, 84, y, 35, paper);
          txt(names[i]![1]!, 84, y + 42, 22, gold);
        });
      }
      credit = "COAST CONTEXT: GRIESEB / 2008 / PUBLIC DOMAIN";
    } else if (shot === 8) {
      heading("1989–1990 / THE OPERATING BUSINESS");
      title(["Help them buy.", "Then manage it."], 84, 345, 78);
      const stages = [
        ["DEVELOP", "APARTMENTS"],
        ["FINANCE", "FORMAL DIVISION / 1989"],
        ["MANAGE", "DIVISION / 1990"],
      ];
      for (let i = 0; i < 3; i++) {
        reveal(e, i * duration * 0.25, () => {
          const y = 630 + i * 190;
          rect(84, y, 840, 130, i === 1 ? "#344738" : "#1a2720", gold);
          txt(stages[i]![0]!, 112, y + 53, 32, paper);
          txt(stages[i]![1]!, 112, y + 101, 22, gold);
          if (i < 2) line(500, y + 130, 500, y + 185, gold, 3);
        });
      }
      note("A business around the apartment.", 1240);
      credit = "VENDOR LENDING EXISTED BEFORE THE FORMAL DIVISION";
    } else if (shot === 9) {
      heading("1998–1999 / REGIS, SYDNEY");
      title(["Already building tall."], 84, 340, 77);
      facts.regis.levels.forEach((n, i) => {
        const x = 115 + i * 280,
          q = ease((p - i * 0.08) / 0.36);
        tower(x, 1050, 175, n, q, i === 1 ? gold : green);
        txt(String(Math.round(n * q)), x + 25, 1110, 65, paper);
        txt(i === 0 ? "1998" : "1999", x + 37, 1160, 25, muted);
      });
      if (p > 0.52) {
        reveal(e, duration * 0.52, () => {
          rect(64, 1188, 880, 96, "#26372c");
          txt("CONTRACTS", 84, 1224, 21, gold);
          txt(
            `${aud(facts.regis.contractsAud[0])}  /  ${aud(facts.regis.contractsAud[1])}`,
            84,
            1262,
            32,
            paper
          );
        });
      }
      credit = "LEVEL COUNTS / TWO INDIVIDUAL CONTRACTS, NOT AVERAGES";
    } else if (shot === 10) {
      photo(images.tower, 0, 240, 1080, 1100, 1.06 + p * 0.04, 0.45, 0.1);
      rect(0, 230, 1080, 180, "rgba(17,23,20,.70)");
      shade(700, 1340);
      heading("1999–2004 / WORLD SQUARE");
      title(["World Tower."], 84, 345, 90);
      const q = ease((p - 0.3) / 0.45),
        x = 630,
        base = 1160,
        w = 230,
        h = 660;
      rect(x, base - h, w, h, "rgba(17,23,20,.86)", paper);
      const occupied = Math.round(30 * q);
      for (let i = 0; i < 60; i++) {
        const yy = base - i * 10 - 8;
        line(x + 12, yy, x + w - 12, yy, i < occupied ? green : "#64716a", i < occupied ? 5 : 2);
      }
      reveal(e, duration * 0.35, () => {
        txt("BUILDING", 84, 710, 31, paper);
        txt("ABOVE", 84, 755, 31, paper);
        line(84, 800, 590, 800, paper);
        txt("OCCUPIED", 84, 1035, 31, green);
        txt("BELOW", 84, 1080, 31, green);
        line(84, 1120, 590, 1120, green);
      });
      credit = "PHOTO: ADAM.J.W.C. / 2008 / CC BY 3.0 / DIAGRAM OVERLAY";
    } else if (shot === 11) {
      heading("2003 / SERVICED APARTMENTS");
      title(["Another use.", "Another business."], 84, 340, 78);
      // A floor plan becomes accommodation: furniture, kitchen and nightly use.
      const x = 130,
        y = 590,
        w = 720,
        h = 425;
      rect(x, y, w, h, "#26392d", paper);
      line(x + 455, y, x + 455, y + h, paper, 4);
      line(x + 455, y + 205, x + w, y + 205, paper, 4);
      rect(x + 490, y + 32, 190, 126, "#6b765d", gold);
      line(x + 490, y + 60, x + 680, y + 60, paper);
      rect(x + 35, y + 55, 225, 75, "#465944", gold);
      c.strokeStyle = gold;
      c.lineWidth = 3;
      c.strokeRect(x + 35, y + 200, 145, 90);
      dot(x + 300, y + 295, 42, "#637154");
      reveal(e, 1, () => {
        txt("ROOM TO LIVE", 170, 1110, 31, paper);
      });
      reveal(e, 2, () => {
        txt("AND COOK", 170, 1160, 31, gold);
      });
      note("Apartments become accommodation.", 1240);
    } else if (shot === 12) {
      heading("2009 / THROUGH THE FINANCIAL CRISIS");
      title(["Buying when", "markets hurt."], 84, 340, 79);
      // Parcel diagram is deliberately schematic, not a fictional cadastral map.
      c.save();
      c.translate(94, 590);
      c.transform(1, -0.12, 0.23, 0.65, 0, 0);
      for (let i = 0; i < 12; i++) {
        const x = (i % 4) * 182,
          y = Math.floor(i / 4) * 157;
        rect(x, y, 166, 141, i < ease(p * 2) * 12 ? "#50674e" : "#1c2b21", gold);
      }
      c.restore();
      title(
        [`A$${Math.round((facts.gfc.acquisitionAud / 1e6) * ease(e / 1.3))}m`],
        84,
        1055,
        128,
        gold
      );
      txt("VICTORIA PARK / ZETLAND PURCHASE", 84, 1120, 24, paper);
      reveal(e, duration * 0.57, () => {
        txt("1,800 HOUSING STARTS / FY2008–09", 84, 1240, 29, green);
      });
    } else if (shot === 13) {
      heading("2013–2014 / BORROWING AGAIN");
      title(["Keep more homes.", "Tie up more capital."], 84, 340, 74);
      for (let i = 0; i < 6; i++) {
        const x = 95 + (i % 3) * 282,
          y = 635 + Math.floor(i / 3) * 175;
        house(x, y, 0.55, 1);
      }
      reveal(e, duration * 0.32, () => {
        rect(64, 1050, 890, 225, ink);
        txt("REPORTED DEBT / FEBRUARY 2014", 84, 1095, 24, paper);
        title(["~A$300m"], 84, 1225, 126, gold);
      });
      credit = "BORROWING RESUMED IN 2013 / RETAINING MORE APARTMENTS";
    } else if (shot === 14) {
      photo(images.accommodation, 0, 230, 1080, 1090, 1.02 + p * 0.07, 0.5, 0.05);
      shade(400, 1150);
      rect(64, 820, 890, 410, "rgba(17,23,20,.88)");
      heading("FY2020 / REPORTED GROUP RENTS");
      title(["A$447m"], 84, 990, 146, gold);
      txt("RENTAL INCOME", 84, 1080, 32, paper);
      txt("NOT PROFIT", 84, 1160, 32, green);
      credit = "MERITON CONTEXT: SARDAKA / 2024 / CC0";
    } else {
      photo(images.portrait, 0, 0, 1080, 1330, 1.83 + p * 0.05, 0.53, 0.56);
      shade(700, 1360);
      rect(0, 0, 1080, 240, "rgba(17,23,20,.60)");
      heading("THE BUSINESS BEHIND THE BUILDINGS");
      title(["80,000+"], 84, 945, 126, gold);
      txt("APARTMENTS BUILT", 84, 1020, 32, paper);
      reveal(e, 1, () => {
        txt("BUILD. SELL. FINANCE. HOLD.", 84, 1160, 30, paper);
      });
      note("Harry Triguboff. Meriton.", 1240);
      credit = "COMPANY TOTAL / NOT CURRENT OWNERSHIP / PORTRAIT 2008";
    }
    txt("THE DESK", 84, 125, 23, paper);
    txt(`${String(shot + 1).padStart(2, "0")} / 16`, 790, 125, 22, muted, undefined, 135);
    // One fixed source zone; all visual content ends above the subtitle separator.
    rect(0, 1290, 1080, 165, ink);
    txt(source[shot]!, 84, 1329, 20, muted);
    txt(credit, 84, 1380, 18, muted);
    line(84, 1430, 924, 1430, "#425247", 1);
    line(84, 1430, 84 + (840 * time) / total, 1430, gold, 3);
    if (shot > 0 && e < 0.12) {
      rect(0, 240, 1080, 1050, `rgba(17,23,20,${0.23 * (1 - e / 0.12)})`);
    }
    return canvas.data();
  };
}
