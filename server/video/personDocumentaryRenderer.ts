import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { loadAsset } from "../og/instagramCards";
import type { DocumentaryStory } from "./documentaryStory";
import type { MeasuredPhrase } from "./phraseSpeech";
import { TRIGUBOFF_FINANCIAL_FACTS as facts } from "../../shared/documentaryReels";
import { documentaryEdit } from "./documentaryDirection";
import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";

/** Authored documentary sequences. Archive images retain dates and credits.
 * Diagrams explain recorded events; no invented archive documents or cash transfers. */
export const PERSON_DOCUMENTARY_ASSETS = {
  city: {
    file: DOCUMENTARY_PHOTOS.tianjinView.asset,
    sha256: DOCUMENTARY_PHOTOS.tianjinView.sha256,
  },
  detail: {
    file: DOCUMENTARY_PHOTOS.worldTowerDetail.asset,
    sha256: DOCUMENTARY_PHOTOS.worldTowerDetail.sha256,
  },
  construction: {
    file: DOCUMENTARY_PHOTOS.meritonConstruction.asset,
    sha256: DOCUMENTARY_PHOTOS.meritonConstruction.sha256,
  },
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
    "MERITON / FOUNDER PROFILE + DOMAIN / 2018",
    "FORBES AUSTRALIA / 2024",
    "FORBES / 2024 + DOMAIN / 2018",
    "MERITON / 2013 + NATIONAL ARCHIVES",
    "MERITON / 2013 + PROPERTY COUNCIL",
    "FORBES / 2024 + DOMAIN / 2018",
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
    const e = local - (scene.phrases[beat]?.start ?? 0),
      duration = scene.phrases[beat]?.seconds ?? scene.seconds,
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
    const edit = documentaryEdit(shot, p),
      stage = edit.index,
      q = clamp(edit.progress);
    const smooth = ease(q);
    // A real facade motif travels through the early build, sale and retained-stock story.
    // This is an original explanation, not a reconstruction of a specific building.
    const facade = (
      x: number,
      y: number,
      w: number,
      rows: number,
      cols: number,
      fill = 1,
      spread = 0
    ) => {
      const ww = w / cols,
        hh = Math.min(170, ww * 0.82),
        h = rows * hh;
      if (spread < 0.1) {
        rect(x - 18, y - 20, w + 36, h + 40, "#27352f", "#718174");
        rect(x - 28, y - 34, w + 56, 18, "#afb19b");
        for (let row = 0; row <= rows; row++)
          line(x - 15, y + row * hh, x + w + 15, y + row * hh, "#8d9888", 5);
      }
      for (let i = 0; i < rows * cols; i++) {
        const cx = i % cols,
          cy = Math.floor(i / cols);
        const xx = x + cx * ww + (cx - (cols - 1) / 2) * spread * 30;
        const yy = y + cy * hh + cy * spread * 25;
        const occupied = i < fill * rows * cols;
        rect(
          xx + 10,
          yy + 13,
          ww - 20,
          hh - 26,
          occupied ? "#53644c" : "#151f1b",
          occupied ? gold : "#46554a"
        );
        line(xx + ww / 2, yy + 16, xx + ww / 2, yy + hh - 17, "#bcc2aa", 3);
        line(xx + 14, yy + hh * 0.5, xx + ww - 14, yy + hh * 0.5, "#bcc2aa", 3);
        rect(xx + 6, yy + hh - 21, ww - 12, 8, occupied ? "#a8ad91" : "#455347");
      }
    };
    const stamp = (label: string, value: string, y: number, color = gold) => {
      txt(label, 84, y, 27, muted);
      title([value], 84, y + 108, 132, color);
    };
    const card = (value: string, label: string, x: number, y: number, w = 385) => {
      rect(x, y, w, 174, "#e9e2d1");
      txt(label, x + 25, y + 44, 23, "#4c5547", "DocMono", w - 50);
      txt(value, x + 25, y + 124, 57, "#17231c", "DocTitle", w - 50);
    };
    const arrow = (x: number, y: number, xx: number, yy: number, color = gold) => {
      line(x, y, xx, yy, color, 4);
      const a = Math.atan2(yy - y, xx - x);
      line(xx, yy, xx - 18 * Math.cos(a - 0.5), yy - 18 * Math.sin(a - 0.5), color, 4);
      line(xx, yy, xx - 18 * Math.cos(a + 0.5), yy - 18 * Math.sin(a + 0.5), color, 4);
    };
    if (shot === 0) {
      if (stage === 0) {
        photo(images.portrait, 0, 0, 1080, 1320, 2.05 + q * 0.06, 0.53, 0.52);
        shade(650, 1300);
        title(["Harry", "Triguboff."], 84, 1000, 115);
        txt("THE MAN BEHIND MERITON", 84, 1250, 28, gold);
        credit = "PORTRAIT / MERITON / 2008 / PUBLIC DOMAIN";
      } else {
        photo(images.portrait, 430, 280, 650, 1000, 1.85 + q * 0.05, 0.53, 0.48);
        rect(0, 250, 1080, 1040, "rgba(17,23,20,.75)");
        title(["Before the towers,"], 84, 465, 74);
        title(["A$30m"], 84, 790, 181, red);
        txt("REPORTED DEBT / 1974–75", 84, 875, 31, paper);
        reveal(e, duration * 0.68, () => title(["the business", "had to survive."], 84, 1060, 71));
        credit = "DOMAIN / 2018 REPORTED HISTORY / PORTRAIT 2008";
      }
    } else if (shot === 1) {
      if (!stage) {
        photo(images.city, 0, 265, 1080, 1030, 1.05 + q * 0.12, 0.45 + q * 0.08, 0.5);
        shade(780, 1290);
        heading("1933 / BORN IN DALIAN");
        title(["A childhood", "in Tianjin."], 84, 1030, 91);
        txt("CITY ARCHIVE / 1930 / BEFORE HARRY'S BIRTH", 84, 1250, 22, gold);
        credit = "NIKKODO / KYOTO UNIVERSITY LIBRARY / PD / ADAPTED";
      } else {
        photo(images.map, 0, 220, 1080, 1070, 1.03 + q * 0.06, 0.52, 0.45);
        rect(0, 220, 1080, 1070, "rgba(17,23,20,.76)");
        heading("1948 / A NEW COUNTRY");
        title(["Harry and", "his brother."], 84, 450, 96);
        txt("TIANJIN", 100, 810, 42, paper);
        arrow(120, 855, 120 + 700 * smooth, 995, gold);
        title(["Sydney."], 490, 1110, 112);
        txt("JOURNEY CHRONOLOGY / NOT A PLOTTED ROUTE", 84, 1250, 23, muted);
        credit = "MAP / NIKKODO / 1930 / GEOGRAPHICUS / PUBLIC DOMAIN";
      }
    } else if (shot === 2) {
      heading("BEFORE THE FIRST APARTMENTS");
      if (stage === 0) {
        title(["Looking for", "a direction."], 84, 430, 100);
        ["LEEDS", "ISRAEL", "SOUTH AFRICA"].forEach((place, i) => {
          const y = 770 + i * 145;
          reveal(e, i * duration * 0.055, () => {
            dot(115, y, 9);
            txt(place, 160, y + 14, 44, paper);
          });
        });
        txt("TEXTILES", 84, 1240, 29, gold);
      } else if (stage === 1) {
        title(["Taxis."], 84, 430, 125);
        c.save();
        c.translate(110 + q * 45, 740);
        c.beginPath();
        c.moveTo(0, 145);
        c.lineTo(85, 125);
        c.lineTo(185, 20);
        c.lineTo(460, 20);
        c.lineTo(565, 130);
        c.lineTo(710, 160);
        c.lineTo(735, 280);
        c.lineTo(0, 280);
        c.closePath();
        c.fillStyle = "#415a48";
        c.fill();
        c.strokeStyle = paper;
        c.lineWidth = 6;
        c.stroke();
        line(202, 48, 135, 139, gold, 6);
        line(202, 48, 332, 48, gold, 6);
        line(350, 48, 449, 48, gold, 6);
        line(449, 48, 532, 139, gold, 6);
        rect(273, -24, 112, 40, paper);
        txt("TAXI", 285, 5, 28, ink);
        [145, 580].forEach((x) => {
          dot(x, 282, 69, ink);
          c.strokeStyle = paper;
          c.lineWidth = 6;
          c.stroke();
          dot(x, 282, 23, gold);
        });
        c.restore();
        note("An early business. Not the last.", 1240);
      } else if (stage === 2) {
        title(["A milk round."], 84, 430, 104);
        for (let i = 0; i < 3; i++) {
          c.save();
          c.translate(145 + i * 240, 650 + (i % 2) * 45);
          c.beginPath();
          c.moveTo(45, 0);
          c.lineTo(105, 0);
          c.lineTo(105, 115);
          c.lineTo(145, 175);
          c.lineTo(145, 435);
          c.lineTo(5, 435);
          c.lineTo(5, 175);
          c.lineTo(45, 115);
          c.closePath();
          c.fillStyle = "#273b30";
          c.fill();
          c.strokeStyle = paper;
          c.lineWidth = 5;
          c.stroke();
          rect(14, 260, 122, 160, "#dddcca");
          line(40, 23, 110, 23, gold, 7);
          c.restore();
        }
      } else {
        title(["The builder", "wasn't working out."], 84, 410, 76);
        house(275, 650, 1.25, smooth);
        if (q > 0.38) {
          rect(70, 1110, 890, 150, "#273e30");
          txt("HARRY FINISHES THE HOUSE", 105, 1200, 39, paper);
        }
        txt("ROSEVILLE / HIS OWN HOME", 84, 580, 29, gold);
      }
      credit = "ORIGINAL ILLUSTRATIONS / NOT ARCHIVAL OBJECTS";
    } else if (shot === 3) {
      heading("1963 / THE FIRST DEVELOPMENT / TEMPE");
      if (!stage) {
        title(["A piece", "of land."], 84, 430, 112);
        c.save();
        c.translate(160, 820);
        c.transform(1, -0.2, 0.6, 0.65, 0, 0);
        rect(0, 0, 620, 340, "#33493a", gold);
        for (let i = 1; i < 6; i++) line(i * 100, 0, i * 100, 340, "#52654e");
        c.restore();
        stamp("LAND / HISTORICAL AUD EQUIVALENT", aud(facts.tempe.landAud), 1100);
      } else if (stage === 1) {
        title(["Eight flats."], 84, 445, 120);
        facade(135, 700, 725, 2, 4, smooth);
        txt("TWO STOREYS / EIGHT APARTMENTS", 84, 1200, 29, gold);
      } else {
        facade(155, 370, 680, 2, 4);
        c.save();
        c.translate(610, 735);
        c.rotate(-0.1);
        rect(-130, -55, 260, 105, "#e8e2cf");
        txt("SOLD", -92, 16, 52, "#20352a");
        c.restore();
        stamp("GROSS BLOCK SALE / WITHIN EIGHT MONTHS", aud(facts.tempe.saleAud), 920);
        txt("BEFORE CONSTRUCTION AND OTHER COSTS", 84, 1200, 25, paper);
        txt("SALE PROCEEDS ARE NOT PROFIT", 84, 1250, 25, gold);
      }
      credit = "ORIGINAL SCHEMATIC / AUD CONVERSION, NOT INFLATION-ADJUSTED";
    } else if (shot === 4) {
      heading("1960s / MERITON STREET / GLADESVILLE");
      if (!stage) {
        rect(75, 320, 865, 122, "#e5dfcc");
        txt("MERITON STREET", 111, 402, 59, ink);
        facade(120, 610, 760, 3, 6);
        title(["18 apartments."], 84, 1150, 91);
        txt("THE STREET BECOMES THE COMPANY NAME", 84, 1240, 25, gold);
      } else {
        title(["Change the sale."], 84, 390, 96);
        facade(140, 580, 720, 3, 6, 1, smooth);
        card("Whole block", "EARLY APPROACH", 84, 1070);
        card("One by one", "INDIVIDUAL SALES", 520, 1070);
      }
      credit = "ORIGINAL SCHEMATIC / COMPANY DATES GLADESVILLE TO 1968";
    } else if (shot === 5) {
      if (stage < 2) {
        heading(stage === 0 ? "1969 / MERITON FLOATS" : "1973 / HARRY BUYS IT BACK");
        title(stage === 0 ? ["A public", "company."] : ["Back in", "his hands."], 84, 440, 106);
        const gather = stage === 0 ? 0 : smooth;
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI) / 6,
            x = 525 + Math.cos(angle) * 320 * (1 - gather),
            y = 930 + Math.sin(angle) * 240 * (1 - gather);
          dot(x, y, 19, i % 2 ? gold : green);
          if (stage) line(x, y, 525, 930, "#687a65", 2);
        }
        c.save();
        c.beginPath();
        c.arc(525, 930, 145, 0, Math.PI * 2);
        c.clip();
        photo(images.portrait, 380, 785, 290, 290, 2.8, 0.53, 0.46);
        c.restore();
        txt("OWNERSHIP / SCHEMATIC, NOT SHARE PERCENTAGES", 84, 1260, 22, muted);
      } else {
        rect(0, 230, 1080, 1060, "#301e1c");
        txt("1974", 84, 485, 150, red, "DocTitle");
        title(["Then the", "market turns."], 84, 800, 116);
        // No fabricated price chart: this is a chapter break, not a data series.
        line(85, 1130, 920, 1130, red, 7);
      }
      credit = "OWNERSHIP ILLUSTRATION / PORTRAIT: MERITON / 2008 / PD";
    } else if (shot === 6) {
      heading("1974–76 / THE SURVIVAL TEST");
      if (!stage) {
        facade(105, 360, 770, 4, 6, 0.2);
        rect(0, 220, 1080, 1070, "rgba(36,19,19,.54)");
        title(["Growth.", "Then pressure."], 84, 1040, 100);
      } else if (stage === 1) {
        rect(45, 305, 925, 720, "#2b201d");
        txt("DOMAIN'S REPORTED HISTORY", 84, 392, 28, muted);
        title(["A$30m"], 84, 657, 191, red);
        txt("DEBT / 1974–75 DOWNTURN", 84, 762, 35, paper);
        line(84, 845, 900, 845, "#735047", 3);
        title(["The business", "has to survive."], 84, 1010, 75);
      } else {
        txt("1976", 84, 490, 158, paper, "DocTitle");
        title(["Debt repaid."], 84, 690, 104, green);
        facade(140, 900, 700, 1, 5, smooth);
        txt("HE ALSO HELD APARTMENTS FOR RENT", 84, 1220, 28, gold);
      }
      credit = "REPAYMENT SOURCES NOT ITEMISED / WINDOWS ARE ILLUSTRATIVE";
    } else if (shot === 7) {
      photo(images.coast, 0, 220, 1080, 1070, 1.03 + p * 0.08, 0.58, 0.5);
      shade(570, 1290);
      heading("1980s–1990s / THE GOLD COAST");
      if (!stage) {
        title(["Beyond", "Sydney."], 84, 1030, 122);
      } else {
        const names = [
          ["FLORIDA", "1980s"],
          ["THE NELSON", "1980s"],
          ["XANADU", "LATE 1990s"],
        ];
        names.forEach((pair, i) => {
          const y = 690 + i * 190;
          rect(62, y - 50, 883, 157, "rgba(17,23,20,.86)");
          txt(pair[0]!, 92, y + 8, 46, paper);
          txt(pair[1]!, 92, y + 63, 28, gold);
        });
      }
      credit = "GOLD COAST CONTEXT / GRIESEB / 2008 / PD / NOT NAMED PROJECTS";
    } else if (shot === 8) {
      heading("1989–1990 / MORE THAN A BUILDER");
      facade(195, 370, 620, 2, 4);
      const labels = ["BUILD", "FINANCE", "MANAGE"];
      for (let i = 0; i <= stage; i++) {
        const y = 900 + i * 120;
        dot(105, y, 9, i === stage ? gold : muted);
        txt(labels[i]!, 150, y + 14, 49, i === stage ? paper : muted);
        if (i) line(105, y - 100, 105, y - 20, gold, 3);
        txt(
          i === 0 ? "THE APARTMENT" : i === 1 ? "FORMAL DIVISION / 1989" : "DIVISION / 1990",
          495,
          y + 11,
          22,
          gold,
          undefined,
          425
        );
      }
      credit = "BUSINESS MODEL / VENDOR LENDING PRE-DATED THE 1989 DIVISION";
    } else if (shot === 9) {
      heading("1998–1999 / REGIS / SYDNEY");
      if (!stage) {
        title(["Already", "building tall."], 84, 415, 100);
        facts.regis.levels.forEach((n, i) => {
          const x = 110 + i * 282;
          tower(x, 1130, 182, n, ease(q * 1.4 - i * 0.15), i === 1 ? gold : green);
          txt(String(n), x + 38, 1215, 66, paper);
        });
        credit = "32 / 43 / 36 LEVELS / SHARED SCALE, NOT BUILDING LIKENESSES";
      } else {
        title(["The apartments", "inside the towers."], 84, 435, 82);
        tower(685, 1180, 200, 43, 1, "#526752");
        card(aud(facts.regis.contractsAud[0]), "CONTRACT / MARCH 1999", 84, 685, 580);
        card(aud(facts.regis.contractsAud[1]), "CONTRACT / MARCH 1999", 84, 915, 580);
        txt("TWO INDIVIDUAL PRICES. NOT AVERAGES.", 84, 1220, 27, gold);
        credit = "FEDERAL COURT RECORD / FIGURE CARDS, NOT RECREATED DOCUMENTS";
      }
    } else if (shot === 10) {
      if (stage < 2) {
        photo(
          stage === 0 ? images.tower : images.detail,
          0,
          220,
          1080,
          1070,
          1.01 + q * 0.06,
          0.48,
          stage === 0 ? 0.12 : 0.42 - q * 0.15
        );
        shade(670, 1290);
        heading("1999–2004 / WORLD SQUARE");
        title(
          stage === 0 ? ["World", "Tower."] : ["A new scale."],
          84,
          1030,
          stage === 0 ? 124 : 94
        );
        credit =
          stage === 0
            ? "WORLD TOWER / ADAM.J.W.C. / 2008 / CC BY 3.0"
            : "WORLD TOWER / WANG-HSIN PEI / 2014 / CC BY 2.0 / ADAPTED";
      } else {
        heading("2004 / COMPLETION");
        title(["Occupied below.", "Building above."], 84, 390, 75);
        const x = 390,
          y = 595,
          w = 285,
          h = 610;
        rect(x, y, w, h, "#203228", paper);
        for (let i = 0; i < 28; i++)
          line(
            x + 14,
            y + 16 + i * 21,
            x + w - 14,
            y + 16 + i * 21,
            i > 13 ? green : "#667566",
            i > 13 ? 8 : 3
          );
        line(95, 675, x - 20, 675, paper, 3);
        txt("WORK", 95, 630, 30, paper);
        line(x + w + 20, 1100, 920, 1100, green, 3);
        txt("LIFE", 750, 1055, 30, green);
        line(350, y + 290, 720, y + 290, gold, 4);
        txt("CONSTRUCTION AND OCCUPATION OVERLAPPED", 84, 1260, 24, gold);
        credit = "JBW PROJECT ACCOUNT / SCHEMATIC SECTION, NOT FLOOR COUNTS";
      }
    } else if (shot === 11) {
      heading("2003 / SERVICED APARTMENTS BEGIN");
      title(
        stage === 0 ? ["Keep the space."] : stage === 1 ? ["Change its use."] : ["Run the stay."],
        84,
        425,
        94
      );
      const x = 135,
        y = 620,
        w = 720,
        h = 450;
      rect(x, y, w, h, "#314338", paper);
      line(x + 440, y, x + 440, y + h, paper, 5);
      line(x + 440, y + 215, x + w, y + 215, paper, 5);
      if (stage >= 1) {
        rect(x + 475, y + 32, 204, 140, "#899279", gold);
        rect(x + 480, y + 36, 89, 36, "#e2deca");
        rect(x + 582, y + 36, 89, 36, "#e2deca");
        rect(x + 34, y + 30, 320, 75, "#8b937c", gold);
        rect(x + 37, y + 190, 135, 200, "#53674e", gold);
        dot(x + 300, y + 280, 45, "#b0ac8b");
      }
      if (stage === 2) {
        rect(420, 1100, 475, 154, "#e9e2d1");
        txt("GUEST STAYS", 450, 1150, 27, ink);
        txt("An operating business", 450, 1210, 32, ink, "DocBody", 415);
      } else
        txt(stage === 0 ? "THE APARTMENT" : "BEDROOM. KITCHEN. LIVING SPACE.", 84, 1220, 30, gold);
      credit = "ORIGINAL FLOOR PLAN / ILLUSTRATIVE, NOT A NAMED SUITE";
    } else if (shot === 12) {
      heading("2008–09 / THE GLOBAL FINANCIAL CRISIS");
      if (!stage) {
        title(["Another downturn.", "Another decision."], 84, 435, 86);
        c.save();
        c.translate(140, 780);
        c.transform(1, -0.18, 0.35, 0.62, 0, 0);
        rect(0, 0, 660, 370, "#344d3c", gold);
        line(0, 185, 660, 185, paper, 5);
        line(220, 0, 220, 370, paper, 5);
        line(440, 0, 440, 370, paper, 5);
        c.restore();
        stamp("VICTORIA PARK / ZETLAND LAND PURCHASE", "A$109m", 1080);
      } else {
        title(["1,800"], 84, 540, 206, gold);
        txt("HOUSING STARTS / FY2008–09", 84, 640, 33, paper);
        for (let i = 0; i < 9; i++)
          facade(100 + (i % 3) * 287, 800 + Math.floor(i / 3) * 134, 220, 1, 4, 1);
        credit = "URBAN TASKFORCE / SYMBOLIC BUILDINGS, NOT ONE ICON PER START";
      }
    } else if (shot === 13) {
      heading("2013–2014 / CAPITAL HAS A COST");
      if (!stage) {
        title(["Keep more", "apartments."], 84, 430, 110);
        facade(115, 710, 770, 3, 5);
        txt("MORE CAPITAL STAYS IN THE BUILDINGS", 84, 1240, 28, gold);
      } else {
        title(["Borrow again."], 84, 445, 112);
        stamp("REPORTED DEBT / FEBRUARY 2014", "~A$300m", 740);
        txt("BORROWING RESUMED IN 2013", 84, 1090, 34, paper);
        txt("RETAINING STOCK TIES UP CAPITAL", 84, 1240, 28, gold);
      }
      credit = "THE BUSINESS TIMES / 13 FEBRUARY 2014 / APPROXIMATE DEBT";
    } else if (shot === 14) {
      photo(images.accommodation, 0, 220, 1080, 1070, 1.05 + p * 0.05, 0.5, 0.08);
      shade(390, 1290);
      heading("FY2020 / REPORTED GROUP RENTS");
      title(["A$447m"], 84, 1000, 160, gold);
      txt(
        stage === 0 ? "RENTAL INCOME" : "RENTAL INCOME IS NOT PROFIT",
        84,
        1120,
        stage === 0 ? 38 : 31,
        paper
      );
      if (stage) txt("GROUP ACCOUNTS / ONE FINANCIAL YEAR", 84, 1230, 26, gold);
      credit = "MERITON BUILDING / SARDAKA / 2024 / CC0 / LATER CONTEXT";
    } else {
      if (stage === 0) {
        heading("1963 / THE BEGINNING");
        title(["Eight flats."], 84, 490, 120);
        facade(135, 760, 725, 2, 4);
      } else if (stage === 1) {
        photo(images.detail, 0, 220, 1080, 1070, 1.04 + q * 0.08, 0.5, 0.3);
        shade(540, 1290);
        title(["80,000+"], 84, 1030, 163, gold);
        txt("APARTMENTS BUILT / COMPANY TOTAL", 84, 1140, 29, paper);
        txt("CUMULATIVE BUILT. NOT CURRENT OWNERSHIP.", 84, 1240, 23, gold);
        credit = "WORLD TOWER / WANG-HSIN PEI / 2014 / CC BY 2.0 / ADAPTED";
      } else {
        photo(images.construction, 0, 220, 1080, 1070, 1.01 + q * 0.05, 0.5, 0.35);
        shade(440, 1290);
        const words = ["BUILD.", "SELL.", "FINANCE.", "MANAGE.", "HOLD."];
        words.forEach((word, i) => {
          if (q >= i * 0.13) txt(word, 84, 535 + i * 120, 83, i === 4 ? gold : paper, "DocTitle");
        });
        txt("HARRY TRIGUBOFF / THE BUSINESS BEHIND THE SKYLINE", 84, 1240, 23, gold);
        credit = "MERITON CRANES / PARRAMATTA / RCBUTCHER / 2015 / PD";
      }
    }
    const masthead = c.createLinearGradient(0, 0, 0, 235);
    masthead.addColorStop(0, "rgba(17,23,20,.85)");
    masthead.addColorStop(1, "rgba(17,23,20,0)");
    c.fillStyle = masthead;
    c.fillRect(0, 0, 1080, 235);
    txt("THE DESK", 84, 125, 26, paper);
    txt("PROPERTY EMPIRES", 660, 125, 22, muted, undefined, 260);
    // One fixed source zone; all visual content ends above the subtitle separator.
    rect(0, 1290, 1080, 165, ink);
    txt(source[shot]!, 84, 1330, 22, muted);
    txt(credit, 84, 1380, 20, muted);
    line(84, 1430, 924, 1430, "#425247", 1);
    line(84, 1430, 84 + (840 * time) / total, 1430, gold, 3);
    if (shot > 0 && e < 0.12) {
      rect(0, 240, 1080, 1050, `rgba(17,23,20,${0.23 * (1 - e / 0.12)})`);
    }
    return canvas.data();
  };
}
