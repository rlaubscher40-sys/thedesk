import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { loadAsset } from "../og/instagramCards";
import { DOCUMENTARY_SOURCES } from "../../shared/documentaryReels";
import type { DocumentaryStory } from "./documentaryStory";
import type { DocumentaryTimeline } from "./documentaryShotPlan";
import { SERIES_ASSETS, seriesShots, type SeriesShot } from "./documentarySeriesDirection";

/** Photographic sequences and original event illustrations.
 * No invented portraits, authentic-looking records, returns or project designs. */
export async function createSeriesDocumentaryRenderer(
  story: DocumentaryStory,
  scenes: DocumentaryTimeline,
  total: number
) {
  if (story.treatment !== "series-led-v1") throw new Error("Wrong series treatment.");
  seriesShots(story.id, 15);
  const images: Record<string, Image> = {};
  for (const [key, asset] of Object.entries(SERIES_ASSETS)) {
    const data = await loadAsset(asset.file);
    if (!data) throw new Error(`Series asset missing: ${asset.file}`);
    const bytes = Buffer.from(data.split(",")[1]!, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
      throw new Error("Series asset hash changed.");
    images[key] = await loadImage(bytes);
  }
  for (const [file, font] of [
    ["PlayfairDisplay-Bold.woff", "SeriesTitle"],
    ["DeskEditorialSans-Regular.woff", "SeriesBody"],
    ["JetBrainsMono-Regular.woff", "SeriesMono"],
  ]) {
    const data = await loadAsset(file!);
    if (!data || !GlobalFonts.register(Buffer.from(data.split(",")[1]!, "base64"), font!))
      throw new Error("Series font unavailable.");
  }
  const canvas = createCanvas(1080, 1920),
    c = canvas.getContext("2d");
  const lowy = story.id === "lowy-westfield",
    walker = story.id === "walker-rebuild";
  const ink = lowy ? "#211419" : walker ? "#101e26" : "#1e1a16";
  const paper = "#f0e9d9",
    muted = "#bab8ae",
    gold = lowy ? "#e6b99b" : walker ? "#8dc8d3" : "#ddb879";
  const green = "#a6c79d",
    red = "#e4967e";
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (v: number) => 1 - (1 - clamp(v)) ** 3;
  const grain = createCanvas(256, 256),
    gc = grain.getContext("2d");
  let seed = 17419;
  for (let i = 0; i < 2600; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 256;
    seed = (seed * 16807) % 2147483647;
    gc.fillStyle = i % 2 ? "rgba(255,244,217,.05)" : "rgba(0,0,0,.06)";
    gc.fillRect(x, seed % 256, 1, 1);
  }
  function box(x: number, y: number, w: number, h: number, fill = ink, border?: string) {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    if (border) {
      c.strokeStyle = border;
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);
    }
  }
  function line(x: number, y: number, x2: number, y2: number, colour = gold, width = 3) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke();
  }
  function dot(x: number, y: number, r: number, colour = gold) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = colour;
    c.fill();
  }
  function poly(points: number[][], fill: string, stroke?: string) {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.stroke();
    }
  }
  function text(
    copy: string,
    x: number,
    y: number,
    size = 30,
    colour = paper,
    font = "SeriesMono",
    max = 840
  ) {
    c.fillStyle = colour;
    c.font = `${size}px ${font}`;
    while (c.measureText(copy).width > max && size > 20) {
      size--;
      c.font = `${size}px ${font}`;
    }
    c.fillText(copy, x, y);
  }
  function title(lines: string[], y = 1030, size = 96, colour = paper, x = 80, max = 840) {
    lines.forEach((t, i) => text(t, x, y + i * size * 1.06, size, colour, "SeriesTitle", max));
  }
  function region(key: string, x: number, y: number, w: number, h: number, q: number, zoom = 1) {
    const img = images[key]!,
      a = SERIES_ASSETS[key]!;
    const scale = Math.max(w / img.width, h / img.height) * (zoom + q * 0.065);
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.drawImage(
      img,
      x + (w - img.width * scale) * a.focus,
      y + (h - img.height * scale) * a.verticalFocus,
      img.width * scale,
      img.height * scale
    );
    c.restore();
  }
  function shade(y: number, h: number, strength = 0.96) {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    c.fillStyle = g;
    c.fillRect(0, y, 1080, h);
  }
  function photo(shot: SeriesShot, q: number) {
    const key = shot.photo!;
    if (shot.layout === "plate") {
      box(64, 300, 896, 710, paper);
      region(key, 78, 314, 868, 664, q);
      text("ARCHIVE / " + shot.title.toUpperCase(), 88, 997, 19, ink, "SeriesMono", 845);
      title(shot.lines, 1110, 72);
    } else if (shot.layout === "detail") {
      region(key, 0, 250, 1080, 960, q, 1.18);
      shade(670, 545);
      box(80, 360, 8, 180, gold);
      title(shot.lines, 995, 96);
    } else {
      region(key, 0, 240, 1080, 1075, q);
      shade(670, 655);
      title(shot.lines, 1050, 96);
    }
  }
  function drafting(y = 350) {
    for (let i = 0; i < 8; i++) line(84, y + i * 105, 928, y + i * 105, "rgba(221,184,121,.09)", 1);
    for (let i = 0; i < 9; i++)
      line(84 + i * 105, y, 84 + i * 105, 1200, "rgba(221,184,121,.07)", 1);
  }
  function slab(q: number, large = false) {
    const top = large ? 570 : 690,
      base = 1080;
    poly(
      [
        [160, top + 175],
        [590, top],
        [930, top + 180],
        [498, top + 350],
      ],
      "#514d40",
      gold
    );
    poly(
      [
        [160, top + 175],
        [498, top + 350],
        [498, top + 390],
        [160, top + 215],
      ],
      "#292d26",
      gold
    );
    poly(
      [
        [498, top + 350],
        [930, top + 180],
        [930, top + 220],
        [498, top + 390],
      ],
      "#394439",
      gold
    );
    c.save();
    c.beginPath();
    c.moveTo(160, top + 175);
    c.lineTo(590, top);
    c.lineTo(930, top + 180);
    c.lineTo(498, top + 350);
    c.closePath();
    c.clip();
    for (let i = 0; i < 20; i++) line(120 + i * 55, top, 470 + i * 55, base, "#ada68e", 1);
    for (let i = 0; i < 20; i++) line(80, top + i * 30, 1100, top + i * 30 - 330, "#807b66", 1);
    const wipe = 180 + ease(q) * 750;
    poly(
      [
        [160, top + 175],
        [590, top],
        [wipe, top + 180],
        [498, top + 350],
      ],
      "#858575"
    );
    c.restore();
    const sx = 310 + Math.sin(q * Math.PI) * 180;
    line(sx, top + 90, sx + 300, top + 250, paper, 8);
    for (const [x, y] of [
      [240, top + 135],
      [740, top + 220],
    ]) {
      dot(x!, y! - 60, 18, paper);
      box(x! - 16, y! - 38, 32, 64, gold);
      line(x! - 10, y! + 23, x! - 27, y! + 65, paper, 8);
      line(x! + 10, y! + 23, x! + 32, y! + 60, paper, 8);
      line(x!, y! - 15, sx + 120, top + 170, gold, 5);
    }
  }
  function tower(q: number, risk = false) {
    const h = 480 * ease(q + 0.25);
    poly(
      [
        [280, 1110],
        [630, 1005],
        [810, 1080],
        [460, 1190],
      ],
      "#313f37",
      gold
    );
    poly(
      [
        [280, 1110],
        [280, 1110 - h],
        [460, 1190 - h],
        [460, 1190],
      ],
      risk ? "#5b3630" : "#465c55",
      gold
    );
    poly(
      [
        [460, 1190],
        [460, 1190 - h],
        [810, 1080 - h],
        [810, 1080],
      ],
      risk ? "#362a28" : "#253e3e",
      gold
    );
    poly(
      [
        [280, 1110 - h],
        [630, 1005 - h],
        [810, 1080 - h],
        [460, 1190 - h],
      ],
      "#7b8271",
      paper
    );
    for (let i = 1; i < 12; i++) {
      const y = 1190 - i * 39;
      if (y > 1190 - h) {
        line(460, y, 810, y - 110, risk ? red : gold, 2);
        line(280, y - 80, 460, y, risk ? red : gold, 2);
      }
    }
    line(160, 1130, 160, 470, muted, 5);
    line(120, 470, 660, 470, muted, 5);
    line(160, 385, 160, 470, muted, 5);
    line(160, 385, 520, 470, muted, 2);
    for (let i = 0; i < 8; i++) {
      line(135, 500 + i * 75, 185, 550 + i * 75, muted, 2);
      line(185, 500 + i * 75, 135, 550 + i * 75, muted, 2);
    }
    line(620, 470, 620, 570 + 80 * q, gold, 3);
    box(602, 570 + 80 * q, 36, 12, gold);
    if (risk) {
      line(276, 1220, 815, 1220, red, 5);
      for (let i = 0; i < 5; i++) line(320 + i * 90, 1220, 350 + i * 90, 1197, red, 4);
    }
  }
  function shop(x: number, y: number, w: number, h: number, q: number, accent = gold) {
    box(x, y, w, h, "#34473d", accent);
    box(x, y, w, 16, accent);
    for (let i = 0; i < 5; i++) box(x + (i * w) / 5, y, w / 10, 16, paper);
    box(x + 8, y + 29, w * 0.52, h - 42, "#182a2b", muted);
    box(x + w * 0.66, y + 28, w * 0.24, h - 28, "#182a2b", muted);
    line(x + 6, y + h + 4, x + w * clamp(q), y + h + 4, accent, 3);
  }
  function excavator(q: number) {
    const wheelY = 1020;
    c.save();
    c.translate(90 + q * 30, 0);
    box(100, wheelY - 10, 375, 68, "#41483f", paper);
    for (let i = 0; i < 7; i++) dot(126 + i * 52, wheelY + 22, 23, "#85836e");
    box(175, 860, 280, 143, gold);
    box(215, 760, 145, 120, paper);
    box(232, 778, 111, 83, "#1e3540");
    const armY = 650 + Math.sin(q * Math.PI) * 80;
    line(420, 865, 600, armY, gold, 30);
    line(600, armY, 790, 920, gold, 25);
    line(430, 850, 578, armY + 25, paper, 5);
    line(608, armY + 35, 766, 920, paper, 5);
    poly(
      [
        [757, 903],
        [790, 960],
        [880, 963],
        [840, 1020],
        [778, 1000],
        [741, 960],
      ],
      "#56665a",
      gold
    );
    for (let i = 0; i < 6; i++)
      poly(
        [
          [520 + i * 64, 1110],
          [550 + i * 64, 1040 - (i % 3) * 22],
          [580 + i * 64, 1110],
        ],
        "#625747"
      );
    line(80, 1110, 920, 1110, muted, 3);
    c.restore();
  }
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside series timeline.");
    const si = scenes.findLastIndex((s) => s.start <= time),
      measured = scenes[si]!,
      scene = story.scenes[si]!;
    const local = time - measured.start,
      pi = Math.max(
        0,
        measured.phrases.findLastIndex((p) => p.start <= local)
      ),
      phrase = measured.phrases[pi]!;
    const p = clamp((local - phrase.start) / phrase.seconds),
      shots = seriesShots(story.id, si * 2 + pi),
      index = Math.min(shots.length - 1, Math.floor(p * shots.length));
    const shot = shots[index]!,
      q = clamp(p * shots.length - index),
      e = ease(q * 2),
      accent = shot.accent === "red" ? red : shot.accent === "green" ? green : gold;
    box(0, 0, 1080, 1920, ink);
    let credit = "ORIGINAL EXPLANATORY ILLUSTRATION / THE DESK";
    if (shot.photo) credit = SERIES_ASSETS[shot.photo]!.credit;
    if (shot.secondPhoto) credit += " + " + SERIES_ASSETS[shot.secondPhoto]!.credit;
    if (shot.kind === "photo") photo(shot, q);
    else if (shot.kind === "portrait") {
      region(shot.photo!, 80, 290, 850, 850, q, 1.65);
      shade(800, 390);
      title(shot.lines, 1090, 94);
      text("THE PERSON", 80, 268, 23, accent);
    } else if (shot.kind === "pair") {
      region(shot.photo!, 62, 285, 900, 455, q);
      region(shot.secondPhoto!, 62, 760, 900, 455, 1 - q);
      box(62, 713, 900, 47, ink);
      text("01 / " + SERIES_ASSETS[shot.photo!]!.credit.split(" / ")[0], 80, 744, 22, muted);
      shade(1020, 250);
      title(shot.lines, 1080, 70);
    } else if (shot.kind === "amount") {
      if (shot.photo) {
        region(shot.photo, 0, 240, 1080, 460, q);
        shade(430, 300);
      } else {
        drafting();
        for (let i = 0; i < 4; i++) box(120 + i * 15, 300 + i * 17, 715, 120, "#35342b", muted);
      }
      box(66, 690, 884, 411, paper);
      text("THE NUMBER / THE MEASURE", 97, 747, 25, ink);
      line(97, 783, 917, 783, "#b8ae98", 1);
      text(shot.lines[0]!, 97, 921, 130, ink, "SeriesTitle", 805);
      text(shot.lines[1]!, 97, 1030, 39, ink, "SeriesBody", 805);
      box(66, 1090, 884 * e, 11, accent);
      text("AUD / HISTORICAL RECORD", 82, 1180, 24, accent);
    } else if (shot.kind === "voyage") {
      title(shot.lines, 395, 94);
      const y = 960,
        shift = q * 45;
      poly(
        [
          [100 + shift, y],
          [700 + shift, y],
          [636 + shift, y + 95],
          [180 + shift, y + 95],
        ],
        "#526156",
        gold
      );
      box(220 + shift, y - 145, 300, 135, "#c3baa3");
      box(330 + shift, y - 235, 80, 90, gold);
      for (let i = 0; i < 9; i++) box(243 + shift + i * 27, y - 105, 14, 23, ink);
      line(125 + shift, y - 20, 680 + shift, y - 20, paper, 4);
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.moveTo(80, y + 125 + i * 20);
        c.bezierCurveTo(280, y + 105 + i * 20, 540, y + 145 + i * 20, 930, y + 115 + i * 20);
        c.strokeStyle = "#526156";
        c.lineWidth = 2;
        c.stroke();
      }
      line(110, 715, 860, 715, "#776c55", 2);
      dot(110, 715, 9, gold);
      dot(860, 715, 9, gold);
      dot(110 + 750 * e, 715, 6, paper);
      text(si === 1 ? "FOLLOWING WORK" : "ITALY", 90, 675, 25, muted);
      text(si === 1 ? "THREE STATES" : "MELBOURNE", 630, 675, 25, muted);
      if (si === 1) {
        poly(
          [
            [705, 875],
            [790, 745],
            [898, 875],
          ],
          "#71694e",
          gold
        );
        poly(
          [
            [790, 745],
            [822, 875],
            [898, 875],
          ],
          "#38392e",
          gold
        );
      }
    } else if (shot.kind === "camp") {
      title(shot.lines, 395, 94);
      line(95, 1120, 925, 1120, muted, 3);
      poly(
        [
          [130, 1080],
          [480, 640],
          [895, 1080],
        ],
        "#827657",
        gold
      );
      poly(
        [
          [480, 640],
          [585, 1080],
          [895, 1080],
        ],
        "#474837",
        gold
      );
      poly(
        [
          [270, 1080],
          [480, 705],
          [485, 1080],
        ],
        ink,
        muted
      );
      line(480, 640, 480, 585, paper, 5);
      line(130, 1080, 90, 1145, muted, 3);
      line(895, 1080, 950, 1145, muted, 3);
      box(670, 1090, 95, 65, "#514b3b", gold);
      text("A DECADE OF ITINERANT LABOUR", 80, 1210, 29, accent);
    } else if (shot.kind === "calculation") {
      title(["The issue", "arithmetic."], 390, 86);
      text(shot.lines[0]!, 90, 725, 93, paper, "SeriesTitle");
      text(shot.lines[1]!, 90, 880, 120, accent, "SeriesTitle");
      line(90, 951, 910, 951, muted, 3);
      c.save();
      c.globalAlpha = e;
      text("= A$150,000", 90, 1100, 110, paper, "SeriesTitle");
      c.restore();
      text("AGGREGATE ISSUE VALUE / BEFORE COSTS", 90, 1190, 25, muted);
    } else if (shot.kind === "concrete") {
      drafting();
      title(shot.lines, 390, 87);
      slab(q, si === 4);
      text("WORK → SKILL → LARGER CONTRACTS", 82, 1190, 23, accent);
    } else if (shot.kind === "workforce") {
      text(shot.lines[0]!, 80, 560, 190, paper, "SeriesTitle");
      text(shot.lines[1]!, 88, 630, 34, accent);
      const count = shot.count!,
        cols = 16,
        visible = Math.min(count, Math.ceil(count * ease(q * 3)));
      for (let i = 0; i < count; i++) {
        const x = 110 + (i % cols) * 51,
          y = 735 + Math.floor(i / cols) * 53;
        const col = i < visible ? gold : "#4c463a";
        dot(x, y, 6, col);
        box(x - 6, y + 9, 12, 18, col);
        line(x - 3, y + 27, x - 6, y + 37, col, 3);
        line(x + 3, y + 27, x + 6, y + 37, col, 3);
      }
      line(80, 1190, 920, 1190, accent, 2);
    } else if (shot.kind === "family") {
      title(
        si === 3
          ? ["The handover."]
          : si === 7
            ? ["The family."]
            : ["Different work.", "One enterprise."],
        370,
        76
      );
      const labels = shot.lines;
      labels.forEach((t, i) => {
        const y = 650 + i * 250;
        box(82, y, 840, 185, i ? "#31473f" : "#514232", accent);
        text(t, 117, y + 91, 51, paper, "SeriesTitle", 765);
        line(117, y + 143, 117 + 710 * ease(q * 2 - i * 0.2), y + 143, accent, 3);
      });
      if (si === 1) {
        text("FINANCES", 115, 1190, 26, accent);
        for (let i = 0; i < 5; i++) line(445, 1125 + i * 20, 888, 1125 + i * 20, muted, 1);
      } else {
        line(485, 835, 485, 900, accent, 4);
        dot(485, 870, 8, paper);
      }
    } else if (shot.kind === "risk") {
      drafting();
      title(shot.lines, 390, 84, shot.accent === "red" ? red : paper);
      c.save();
      c.translate(0, 285);
      c.scale(1, 0.77);
      tower(q, shot.accent === "red");
      c.restore();
    } else if (shot.kind === "houses") {
      region("tracy", 0, 245, 1080, 455, q);
      shade(480, 255);
      title(shot.lines, 790, 69);
      for (let i = 0; i < 40; i++) {
        const x = 100 + (i % 10) * 81,
          y = 950 + Math.floor(i / 10) * 56;
        const col = i < 40 * e ? green : "#4d5347";
        poly(
          [
            [x, y],
            [x + 22, y - 19],
            [x + 44, y],
            [x + 44, y + 28],
            [x, y + 28],
          ],
          "#314237",
          col
        );
        box(x + 17, y + 9, 11, 19, col);
      }
    } else if (shot.kind === "mall") {
      drafting();
      title(shot.lines, 400, 85);
      const count = shot.count ?? 6,
        cols = count === 22 ? 6 : count === 12 ? 4 : 4,
        rows = Math.ceil(count / cols),
        w = 720 / cols - 14,
        h = Math.min(130, 440 / rows - 18);
      const baseY = 725;
      for (let i = 0; i < count; i++) {
        const x = 100 + (i % cols) * (w + 20),
          y = baseY + Math.floor(i / cols) * (h + 28);
        shop(x, y, w, h, ease(q * 3 - i * 0.025), i < Math.ceil(count * e) ? accent : "#55534a");
      }
      if (count === 12) {
        text("2 DEPARTMENT STORES + SUPERMARKET", 82, 1220, 25, accent);
      }
      if (!shot.count) {
        line(815, 720, 815, 1120, muted, 5);
        for (let i = 0; i < 6; i++) box(780, 750 + i * 56, 90, 40, "#56655a", gold);
      }
    } else if (shot.kind === "shares") {
      title(shot.lines, 385, 90);
      for (let i = 0; i < 5; i++) {
        c.save();
        c.translate(110 + i * 36, 660 + i * 35);
        c.rotate((i - 2) * 0.028);
        box(0, 0, 650, 310, i === 4 ? paper : "#898777", ink);
        text("SHARE ISSUE", 35, 62, 24, ink);
        line(35, 83, 614, 83, "#aaa18f", 1);
        text(
          lowy ? "300,000 ORDINARY SHARES" : "PUBLIC COMPANY",
          35,
          150,
          36,
          ink,
          "SeriesTitle",
          580
        );
        text(lowy ? "A$0.50 EQUIVALENT / SHARE" : "1994 / WALKER CORPORATION", 35, 216, 26, ink);
        text("EDITORIAL EXPLANATION / NOT AN ORIGINAL RECORD", 35, 275, 18, ink, "SeriesMono", 580);
        c.restore();
      }
      line(100, 1195, 910, 1195, accent, 2);
    } else if (shot.kind === "funding") {
      title(["The expansion", "decision."], 390, 86);
      box(90, 660, 790, 140, paper);
      text(shot.lines[0]!, 122, 752, 48, ink, "SeriesTitle", 728);
      line(485, 820, 485, 950, accent, 5);
      line(485, 950, 460, 920, accent, 5);
      line(485, 950, 510, 920, accent, 5);
      shop(190, 998, 590, 163, e);
      text(shot.lines[1]!, 126, 1230, 32, paper, "SeriesMono", 790);
      text("CAPITAL FOR THE NEXT PROJECT", 117, 880, 22, accent, "SeriesMono", 350);
    } else if (shot.kind === "route") {
      title(shot.lines, 390, 86);
      const stops = [
        ["SYDNEY", "1959"],
        ["QUEENSLAND", "1967"],
        ["VICTORIA", "1969"],
        ["UNITED STATES", "1977"],
      ];
      stops.forEach(([place, date], i) => {
        const x = 140 + i * 195,
          y = 760 + (i % 2) * 200;
        if (i < 3) {
          const nx = 140 + (i + 1) * 195,
            ny = 760 + ((i + 1) % 2) * 200;
          line(x, y, x + (nx - x) * e, y + (ny - y) * e, "#596a60", 3);
        }
        dot(x, y, 14, i === 3 ? paper : accent);
        text(date!, x - 50, y - 40, 34, paper);
        text(place!, x - 50, y + 50, 21, muted, "SeriesMono", 210);
      });
      text("CENTRE OPENINGS + FIRST US ACQUISITION", 80, 1200, 25, accent);
    } else if (shot.kind === "earthworks") {
      drafting();
      title(shot.lines, 390, 86);
      excavator(q);
      // Keep the machine's silhouette clear; do not draw buildings over its boom.
    } else if (shot.kind === "portfolio") {
      title(shot.lines, 385, 77);
      const keep = shot.accent === "green";
      for (let i = 0; i < 3; i++) {
        const y = 735 + i * 146,
          offset = keep ? 0 : e * 85;
        box(85 + offset, y, 685, 117, keep ? "#294139" : "#3a3e39", accent);
        const labels = shot.labels ?? ["PROPERTY", "DEVELOPMENT", "BUSINESSES"];
        text(labels[i]!, 120 + offset, y + 75, 34, paper, "SeriesMono", 600);
        line(813, y + 55, 920, y + 55, accent, 4);
        if (keep) {
          line(840, y + 80, 860, y + 100, green, 5);
          line(860, y + 100, 896, y + 45, green, 5);
        } else {
          line(920, y + 55, 900, y + 34, accent, 4);
          line(920, y + 55, 900, y + 76, accent, 4);
        }
      }
      text(keep ? "INTERESTS RETAINED" : "TRANSACTION / BUSINESS INTERESTS", 85, 1220, 25, accent);
    } else {
      // Chronology pages are clearly authored graphics, not forged source documents.
      box(70, 315, 890, 862, paper);
      text("A BUSINESS IN CHAPTERS", 110, 385, 25, ink);
      line(110, 415, 915, 415, "#a9a28e", 2);
      shot.lines.forEach((t, i) => text(t, 110, 650 + i * 233, 108, ink, "SeriesTitle", 795));
      text("HISTORICAL CHRONOLOGY / THE DESK", 110, 1125, 21, "#6f715f");
      line(110, 1010, 110 + 790 * e, 1010, gold, 7);
    }
    c.fillStyle = c.createPattern(grain, "repeat")!;
    c.fillRect(0, 240, 1080, 1060);
    box(0, 0, 1080, 242, ink);
    text("THE DESK", 80, 115, 28);
    text(story.series.toUpperCase(), 644, 115, 21, muted, "SeriesMono", 280);
    line(80, 154, 922, 154, "#5c6557", 1);
    text(scene.chapter, 80, 212, 25, accent);
    box(0, 1280, 1080, 176, ink);
    if (shot.note) {
      box(70, 1232, 874, 42, ink);
      text(shot.note, 82, 1263, 23, accent, "SeriesMono", 838);
    }
    const publisher = scene.sources
      .map((id) =>
        DOCUMENTARY_SOURCES[id].publisher
          .replace("ANU / Ilma Martinuzzi O'Brien", "ANU biography")
          .replace("Property Council of Australia", "Property Council")
          .replace("Wikipedia / cited historical reporting", "Company history / secondary")
      )
      .join(" + ");
    text((scene.analysis ? "ANALYSIS / " : "SOURCE / ") + publisher, 80, 1320, 21, muted);
    if (credit.length > 100) {
      const parts = credit.split(" + ");
      parts.forEach((t, i) => text(t, 80, 1358 + i * 25, 19, muted));
    } else text(credit, 80, 1370, 19, muted);
    line(80, 1430, 920, 1430, "#586254", 1);
    line(80, 1430, 80 + (840 * time) / total, 1430, accent, 3);
    return canvas.data();
  };
}
