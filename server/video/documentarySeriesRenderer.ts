import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { loadAsset } from "../og/instagramCards";
import { DOCUMENTARY_SOURCES } from "../../shared/documentaryReels";
import type { DocumentaryStory } from "./documentaryStory";
import type { DocumentaryTimeline } from "./documentaryShotPlan";
import { SERIES_ASSETS, seriesShots } from "./documentarySeriesDirection";

/** Authored motion graphics, dated photographs and explicit illustrative labels.
 * No fictional family portraits, archive documents, reviews or financial transfers. */
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
  const ink = "#111714",
    paper = "#eee9da",
    muted = "#a6afa6",
    gold = "#d9b57a",
    green = "#8ac4a0",
    red = "#e08b79";
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (v: number) => 1 - (1 - clamp(v)) ** 3;
  function text(
    copy: string,
    x: number,
    y: number,
    size = 28,
    colour = paper,
    font = "SeriesMono",
    max = 840
  ) {
    c.fillStyle = colour;
    c.font = `${size}px ${font}`;
    while (c.measureText(copy).width > max && size > 18) {
      size--;
      c.font = `${size}px ${font}`;
    }
    c.fillText(copy, x, y);
  }
  function line(x: number, y: number, x2: number, y2: number, colour = gold, width = 3) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke();
  }
  function box(x: number, y: number, w: number, h: number, colour = "#26392f", border?: string) {
    c.fillStyle = colour;
    c.fillRect(x, y, w, h);
    if (border) {
      c.strokeStyle = border;
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);
    }
  }
  function dot(x: number, y: number, r: number, colour = gold) {
    c.beginPath();
    c.arc(x, y, r, 0, 2 * Math.PI);
    c.fillStyle = colour;
    c.fill();
  }
  function photograph(img: Image, progress: number) {
    const scale = Math.max(1080 / img.width, 1070 / img.height) * (1.025 + progress * 0.065);
    c.save();
    c.beginPath();
    c.rect(0, 220, 1080, 1070);
    c.clip();
    c.drawImage(
      img,
      (1080 - img.width * scale) / 2,
      220 + (1070 - img.height * scale) * 0.2,
      img.width * scale,
      img.height * scale
    );
    c.restore();
    const g = c.createLinearGradient(0, 280, 0, 1290);
    g.addColorStop(0, "rgba(17,23,20,.08)");
    g.addColorStop(0.48, "rgba(17,23,20,.2)");
    g.addColorStop(1, ink);
    c.fillStyle = g;
    c.fillRect(0, 220, 1080, 1070);
  }
  const title = (lines: string[], y: number, size: number, colour = paper) =>
    lines.forEach((t, i) => text(t, 84, y + i * size * 1.12, size, colour, "SeriesTitle"));
  return async (time: number) => {
    if (!Number.isFinite(time) || time < 0 || time >= total)
      throw new Error("Frame outside series timeline.");
    const si = scenes.findLastIndex((s) => s.start <= time),
      measured = scenes[si]!,
      scene = story.scenes[si]!;
    const local = time - measured.start;
    const pi = Math.max(
      0,
      measured.phrases.findLastIndex((p) => p.start <= local)
    );
    const phrase = measured.phrases[pi]!;
    const p = clamp((local - phrase.start) / phrase.seconds);
    const shots = seriesShots(story.id, si * 2 + pi),
      index = Math.min(shots.length - 1, Math.floor(p * shots.length));
    const shot = shots[index]!,
      q = clamp(p * shots.length - index),
      e = ease(q * 3);
    const accent = shot.accent === "red" ? red : shot.accent === "green" ? green : gold;
    box(0, 0, 1080, 1920, ink);
    // Quiet drafting grid adds depth without suggesting a real source document.
    for (let x = 84; x <= 924; x += 84) line(x, 255, x, 1270, "#18241e", 1);
    for (let y = 300; y < 1290; y += 84) line(84, y, 924, y, "#18241e", 1);
    let credit = "ORIGINAL EXPLANATORY GRAPHICS / THE DESK";
    if (shot.kind === "photo") {
      photograph(images[shot.photo!]!, q);
      title(shot.lines, 925, 104);
      credit = SERIES_ASSETS[shot.photo!]!.credit;
    } else if (shot.kind === "title") {
      text(String(si + 1).padStart(2, "0"), 84, 420, 115, accent);
      line(84, 455, 84 + 840 * e, 455, accent, 2);
      title(shot.lines, 660, 110);
      // A small date/section marker stays in motion, not a second paragraph.
      line(84, 1050, 84 + 840 * e, 1050, accent, 4);
    } else if (shot.kind === "ledger") {
      box(84, 425, 840, 630, paper);
      text("THE RECORD", 119, 492, 25, "#4b5c4e");
      line(119, 525, 889, 525, "#a6afa6", 1);
      shot.lines.forEach((t, i) =>
        text(
          t,
          119,
          700 + i * 142,
          i === 0 ? 119 : 55,
          ink,
          i === 0 ? "SeriesTitle" : "SeriesBody",
          770
        )
      );
      box(84, 1037, 840 * e, 18, accent);
      text(
        shot.lines.some((t) => t.includes("A$"))
          ? "AUD / PERIOD AND MEASURE MATTER"
          : "KEEP THE CLAIM PRECISE",
        84,
        1140,
        27,
        accent
      );
    } else if (shot.kind === "ownership") {
      const halves = [
        [84, green],
        [519, accent],
      ] as const;
      box(84, 440, 840, 575, "#1e3027", paper);
      halves.forEach(([x, colour], i) => {
        box(x, 450, 405, 555, "#1e3027");
        text("50%", x + 95, 385, 76, colour, "SeriesTitle", 300);
        for (let r = 0; r < 6; r++)
          for (let col = 0; col < 3; col++)
            box(x + 30 + col * 117, 505 + r * 68, 82, 38, q > 0.08 * r ? colour : "#31483b");
        text(shot.lines[i]!, x + 22, 1115, 35, colour, "SeriesMono", 361);
      });
      line(504, 450, 504, 1005, paper, 2);
      text("ONE PROPERTY / TWO EQUAL INTERESTS", 84, 1190, 28, muted);
    } else if (shot.kind === "split") {
      shot.lines.forEach((label, i) => {
        const y = 480 + i * 330;
        dot(160, y + 50, 37, i ? accent : green);
        c.beginPath();
        c.arc(160, y + 150, 62, Math.PI, 0);
        c.strokeStyle = i ? accent : green;
        c.lineWidth = 4;
        c.stroke();
        line(265, y + 60, 905, y + 60, "#425247", 2);
        text(label, 265, y + 130, 53, i ? accent : green, "SeriesTitle", 640);
      });
      line(160, 685, 160, 765, muted, 2);
    } else if (shot.kind === "timeline") {
      shot.lines.forEach((t, i) => {
        const y = 480 + i * 265,
          reveal = ease(q * 4 - i * 0.55);
        if (i < shot.lines.length - 1) line(122, y, 122, y + 265 * reveal, accent, 3);
        dot(122, y, 12, accent);
        text(String(i + 1).padStart(2, "0"), 170, y - 38, 23, muted);
        c.save();
        c.globalAlpha = 0.4 + 0.6 * reveal;
        text(t, 170, y + 20, 55, paper, "SeriesTitle", 750);
        c.restore();
      });
    } else if (shot.kind === "grid") {
      text(shot.lines[0]!, 84, 465, 150, accent, "SeriesTitle");
      text(shot.lines[1]!, 84, 550, 30);
      const count = shot.count!,
        columns = count > 150 ? 20 : count > 70 ? 16 : 7;
      const rows = Math.ceil(count / columns),
        cellW = 840 / columns,
        cellH = Math.min(68, 570 / rows);
      for (let i = 0; i < count; i++) {
        const x = 84 + (i % columns) * cellW,
          y = 650 + Math.floor(i / columns) * cellH;
        box(x + 4, y + 4, cellW - 8, cellH - 8, i < count * ease(q * 2.2) ? accent : "#293d31");
      }
    } else if (shot.kind === "tower") {
      title(shot.lines, 375, 78);
      for (let k = 0; k < 2; k++) {
        const x = 165 + k * 390,
          height = 570 - k * 110,
          y = 1170 - height * (0.8 + 0.2 * e);
        box(x, y, 295, 1170 - y, "#21372b", accent);
        for (let row = 0; row < 10 - k * 2; row++)
          for (let col = 0; col < 4; col++)
            box(x + 24 + col * 64, y + 22 + row * 50, 39, 27, row / 10 < e ? accent : "#384c40");
      }
    } else if (shot.kind === "room") {
      title(shot.lines, 375, 78);
      // Schematic, purpose-built apartment: living, sleeping, kitchen and entry.
      box(120, 610, 750, 555, "#1c2e24", paper);
      line(550, 610, 550, 995, gold, 5);
      line(120, 990, 725, 990, gold, 5);
      box(620, 700, 180, 240, "#536c58", paper);
      box(635, 715, 65, 50, paper);
      box(720, 715, 65, 50, paper);
      box(175, 690, 90, 200, "#536c58", gold);
      box(295, 745, 135, 90, "#665945", gold);
      box(145, 1040, 390, 70, "#536c58", paper);
      dot(205, 1075, 17, paper);
      dot(260, 1075, 17, paper);
      const keyX = 820 - e * 180;
      dot(keyX, 1080, 21, gold);
      line(keyX - 21, 1080, keyX - 95, 1080, gold, 8);
      line(keyX - 80, 1080, keyX - 80, 1105, gold, 6);
    } else {
      title(shot.lines, 400, 90, shot.accent === "red" ? red : paper);
      for (let i = 0; i < 3; i++) {
        const y = 730 + i * 140;
        box(84, y, 620, 95, "#26392f", muted);
        line(120, y + 35, 435, y + 35, muted, 5);
        line(120, y + 62, 550, y + 62, muted, 4);
        if (i === 1 && shot.accent === "red") {
          line(744, y + 15, 804, y + 75, red, 7);
          line(804, y + 15, 744, y + 75, red, 7);
        } else {
          line(735, y + 48, 840, y + 48, accent, 4);
          line(840, y + 48, 820, y + 28, accent, 4);
        }
      }
    }
    const top = c.createLinearGradient(0, 0, 0, 245);
    top.addColorStop(0, ink);
    top.addColorStop(1, "rgba(17,23,20,.5)");
    c.fillStyle = top;
    c.fillRect(0, 0, 1080, 245);
    text("THE DESK", 84, 125, 26);
    text(story.series.toUpperCase(), 660, 125, 22, muted, "SeriesMono", 264);
    text(scene.chapter, 84, 210, 26, accent);
    if (shot.note) text(shot.note, 84, 1250, 25, accent);
    box(0, 1290, 1080, 165, ink);
    const publisher = scene.sources
      .map((id) =>
        DOCUMENTARY_SOURCES[id].publisher
          .replace("ANU / Ilma Martinuzzi O'Brien", "ANU biography")
          .replace("Property Council of Australia", "Property Council")
      )
      .join(" + ");
    text(
      `${scene.analysis ? "THE DESK ANALYSIS / " : "SOURCE / "}${publisher}`,
      84,
      1330,
      22,
      muted
    );
    text(credit, 84, 1380, 20, muted);
    line(84, 1430, 924, 1430, "#425247", 1);
    line(84, 1430, 84 + (840 * time) / total, 1430, gold, 3);
    return canvas.data();
  };
}
