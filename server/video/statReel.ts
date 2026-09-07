/**
 * Turning a stat card into a narrated Reel.
 *
 * Reels are the only surface on Instagram that reliably reaches people who do
 * not already follow the account, so this is the format that decides whether
 * the publication grows. The first version of this file argued that the clip
 * should be silent and that four stills were enough. Both were wrong, and the
 * comparison that proved it was sitting on a competitor's profile: their Reels
 * are narrated, they move continuously, and next to them a silent slideshow
 * reads as a placeholder.
 *
 * What is kept from that first version is the part that was right: the frames
 * come from `renderStatCard`, the same component the grid post uses. The card
 * is the brand, generated footage next to checkable figures would undermine the
 * one thing the publication sells, and one design with two outputs cannot drift.
 * The fix was never "use AI video". It was to stop treating the card as a
 * poster and start cutting it like a broadcast.
 *
 * ## What changed, and why each thing was wrong
 *
 * **A voice.** `narration.ts` speaks the card's own text — the metric name, the
 * figure, the verified sentence, the computed claim — and the pictures are cut
 * to the actual measured length of each passage. Nothing new is written for the
 * audio. The old file claimed silence was right because feed video is watched
 * muted; a narrated Reel is watched by the people who unmute, and they are the
 * ones who follow.
 *
 * **The zoom was pointing at the wrong place.** `zoompan` without `x`/`y`
 * anchors the crop at the top-left corner, so the old clip did not push into
 * the number, it slid off it. It also restarted from 1.0 at every cut, which is
 * a visible hitch four times a clip. There is now one continuous ramp across
 * the whole piece: each beat renders its own slice of a single global zoom, so
 * the motion never stops and never restarts.
 *
 * **Elements popped in.** Opacity went 0 to 1 between hard cuts. Beats now
 * cross-dissolve, so the sentence arrives rather than appears.
 *
 * **The number just showed up.** It now counts up to itself. That is the one
 * piece of motion that makes a data clip look made rather than exported, and it
 * costs nothing but a handful of extra renders.
 *
 * **Everything was soft when it moved.** Frames are upscaled before the zoom
 * and the crop is resampled back down to 1080 wide, so a pushed-in frame is
 * still sharp instead of being a stretched 1080.
 *
 * ## Why stills and ffmpeg rather than a frame loop
 *
 * Satori takes about a second per render at this size, so animating in
 * JavaScript at 30fps would be minutes of work per post. One still per beat and
 * ffmpeg supplying the motion gets the same result in seconds, and the pacing
 * stays legible as a table instead of hiding in a loop.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { type CardVariant, renderStatCard } from "../og/instagramCards";
import {
  buildScript,
  estimateSpeechSeconds,
  synthesiseScript,
  type ReelStatText,
} from "./narration";

const run = promisify(execFile);

/** Reels are 9:16. 1080x1920 is what Instagram serves at, so encoding there
 *  avoids a re-scale on their side. */
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

/** 30fps is plenty for a slow push over static type, and halves the encode
 *  against 60 for no visible difference on this material. */
const FPS = 30;

/**
 * The frames are rendered at 1080 wide and then zoomed into, which would
 * upscale a crop and soften it. Rendering the *source* at double and letting
 * the crop resample down means even the most pushed-in frame still has more
 * than 1080 real pixels behind it. Satori is not asked to render twice: ffmpeg
 * does the upscale, which costs nothing next to the encode.
 */
const SUPERSAMPLE = 2;

/** The whole clip is one slow push, from here to here. Small on purpose: the
 *  motion should be felt rather than noticed. */
const ZOOM_START = 1.0;
const ZOOM_END = 1.085;

/** Cross-dissolve between passages, and the much faster one between the ticks
 *  of the count-up, where a dissolve is what stops the digits from strobing. */
const SECTION_FADE = 0.34;
const TICK_FADE = 0.05;

/** Ticks in the count-up. Ten is enough to read as motion and cheap enough that
 *  it does not dominate the render time. */
const COUNT_TICKS = 10;
const TICK_SECONDS = 0.09;

/** Silence after each passage, so the voice does not run into itself. The last
 *  one is longer because the clip loops, and looping straight out of a word is
 *  the thing that makes a Reel feel like an accident. */
const TAIL_SECONDS = 0.32;
const FINAL_TAIL_SECONDS = 0.85;

/** No beat is shorter than this once the count-up ticks are taken out, so a
 *  short passage never leaves a frame on screen too briefly to read. */
const MIN_HOLD = 0.55;

export type ReelStat = ReelStatText & { asOf?: Date | null };

export type Frame = { reveal: number; valueText?: string; seconds?: number };
export type Beat = { frame: Frame; seconds: number; fade: number };

/**
 * The numbers the count-up walks through on its way to the real one.
 *
 * Two things matter and neither is obvious. The count starts at the smallest
 * number with the *same digit count* as the target rather than at zero, because
 * a count from zero changes the width of the number and the card reflows under
 * it. And it eases out, so it decelerates into the final figure instead of
 * arriving at full speed — that deceleration is most of what makes the effect
 * read as designed rather than as a glitch.
 *
 * Formatting is copied from the target, not re-derived: the prefix, the suffix,
 * the decimal places and the thousands separators all come from how the card
 * chose to display it, so no tick can show a shape the card would not.
 */
export function countUpFrames(value: string, ticks = COUNT_TICKS): string[] {
  const match = value.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return [];
  const raw = match[0];
  const prefix = value.slice(0, match.index ?? 0);
  const suffix = value.slice((match.index ?? 0) + raw.length);
  const target = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(target) || target === 0) return [];

  const decimals = raw.split(".")[1]?.length ?? 0;
  const grouped = raw.includes(",");
  const magnitude = Math.abs(target);
  const digits = Math.floor(Math.abs(magnitude)).toString().length;
  // Smallest number with the same integer width: 4.3 starts at 1.0, 815,439
  // starts at 100,000. Same character count, so nothing reflows.
  const start = Math.sign(target) * Math.pow(10, digits - 1);

  const format = (n: number) => {
    const fixed = Math.abs(n).toFixed(decimals);
    const [whole, frac] = fixed.split(".");
    const body = grouped ? Number(whole).toLocaleString("en-AU") : whole;
    const sign = n < 0 ? "-" : "";
    return `${prefix}${sign}${body}${frac ? `.${frac}` : ""}${suffix}`;
  };

  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const t = (i + 1) / ticks;
    const eased = 1 - Math.pow(1 - t, 3);
    const next = format(start + (target - start) * eased);
    // Easing out means the last ticks can land on the same rounded figure.
    // Holding a repeated frame reads as a stall, and rendering it costs a
    // second of satori for a picture we already have.
    if (next !== out[out.length - 1]) out.push(next);
  }
  // An exact power of ten has nothing below it at the same width, so there is
  // no count to run. Better one still figure than ten identical frames.
  return out.length > 1 ? out : [];
}

export type Section = { key: string; frames: Frame[]; seconds: number };

/**
 * Lay the clip out: what to show, for how long, and when each passage speaks.
 *
 * Sections are given a wall-clock length by the caller (the measured length of
 * the voice plus a tail). Within a section the fixed frames — the count-up
 * ticks — take their own time and the final frame absorbs whatever is left, so
 * a long sentence holds its card longer rather than cutting away mid-word.
 *
 * The start times returned here are computed *through* the cross-dissolves,
 * not from a naive running total. Each dissolve shortens the timeline by its
 * own length, so a naive sum would drift the audio later and later against the
 * pictures; by the end of the clip that is most of a second, which is the
 * difference between narration and dubbing.
 */
export function layout(sections: Section[]): {
  beats: Beat[];
  starts: number[];
  total: number;
} {
  const beats: Beat[] = [];
  const firstBeatOfSection: number[] = [];

  for (const section of sections) {
    firstBeatOfSection.push(beats.length);
    const fixed = section.frames.slice(0, -1);
    const last = section.frames[section.frames.length - 1];
    if (!last) continue;
    const fixedTotal = fixed.reduce((n, f) => n + (f.seconds ?? TICK_SECONDS), 0);
    fixed.forEach((frame, i) => {
      beats.push({
        frame,
        seconds: frame.seconds ?? TICK_SECONDS,
        // The first beat of a section dissolves from the previous section; the
        // ticks within it dissolve from each other, much faster.
        fade: beats.length === 0 ? 0 : i === 0 ? SECTION_FADE : TICK_FADE,
      });
    });
    beats.push({
      frame: last,
      seconds: Math.max(MIN_HOLD, section.seconds - fixedTotal),
      fade: beats.length === 0 ? 0 : fixed.length === 0 ? SECTION_FADE : TICK_FADE,
    });
  }

  // Chain arithmetic: after k beats the video is `chain` long, and beat k's
  // dissolve begins `fade` before that.
  const arrival: number[] = [];
  let chain = 0;
  beats.forEach((beat, i) => {
    if (i === 0) {
      arrival.push(0);
      chain = beat.seconds;
      return;
    }
    arrival.push(Math.max(0, chain - beat.fade));
    chain = chain + beat.seconds - beat.fade;
  });

  return {
    beats,
    starts: firstBeatOfSection.map((i) => arrival[i] ?? 0),
    total: chain,
  };
}

/**
 * Build the video half of the filter graph.
 *
 * Each still is upscaled, given its slice of the global zoom ramp, and then
 * cross-dissolved onto the chain so far.
 *
 * ## The two things to get right here
 *
 * `zoompan` emits `d` frames FOR EVERY FRAME IT IS GIVEN. Feeding it a stream
 * (`-loop 1 -t 2.2`) multiplies frames catastrophically: the first version of
 * this did that and produced a 118MB file in four and a half minutes for a ten
 * second clip. Each input is a single still, so `d` is the beat's length.
 *
 * And `zoompan` defaults its crop to the top-left corner, not the centre. The
 * `x`/`y` expressions are what make this a push into the number rather than a
 * drift towards the corner of the frame — which is what the silent version was
 * actually doing, and a large part of why it looked cheap.
 *
 * Exported so the pacing can be asserted without invoking ffmpeg.
 */
export function buildVideoGraph(beats: Beat[]): string {
  const total = beats.reduce((n, b, i) => n + b.seconds - (i === 0 ? 0 : b.fade), 0);
  const parts: string[] = [];

  // Each beat's zoom slice is taken from where it sits on the finished
  // timeline, so the ramp is continuous across cuts rather than restarting.
  let chain = 0;
  const spans = beats.map((beat, i) => {
    const startAt = i === 0 ? 0 : chain - beat.fade;
    chain = i === 0 ? beat.seconds : chain + beat.seconds - beat.fade;
    const at = (t: number) => ZOOM_START + (ZOOM_END - ZOOM_START) * (total > 0 ? t / total : 0);
    return { from: at(startAt), to: at(startAt + beat.seconds) };
  });

  beats.forEach((beat, i) => {
    const frames = Math.max(1, Math.round(beat.seconds * FPS));
    const { from, to } = spans[i] ?? { from: ZOOM_START, to: ZOOM_START };
    const z = `${from.toFixed(5)}+(${(to - from).toFixed(5)})*on/${frames}`;
    parts.push(
      `[${i}:v]scale=${REEL_WIDTH * SUPERSAMPLE}:${REEL_HEIGHT * SUPERSAMPLE},` +
        `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=${frames}:s=${REEL_WIDTH}x${REEL_HEIGHT}:fps=${FPS},` +
        `format=yuv420p,setsar=1[v${i}]`
    );
  });

  let label = "[v0]";
  let chained = beats[0]?.seconds ?? 0;
  for (let i = 1; i < beats.length; i++) {
    const beat = beats[i]!;
    const offset = Math.max(0, chained - beat.fade);
    const out = i === beats.length - 1 ? "[vout]" : `[x${i}]`;
    parts.push(
      `${label}[v${i}]xfade=transition=fade:duration=${beat.fade.toFixed(3)}:` +
        `offset=${offset.toFixed(3)}${out}`
    );
    label = out;
    chained = chained + beat.seconds - beat.fade;
  }
  if (beats.length === 1) parts.push(`[v0]null[vout]`);
  return parts.join(";");
}

/**
 * Build the audio half: each passage delayed to the moment its pictures arrive,
 * then mixed onto one track.
 *
 * `normalize=0` matters. `amix` normally divides by the number of inputs so a
 * mix cannot clip, which here — where the passages never overlap — would make
 * a five-passage clip a fifth as loud as a one-passage clip. The fade at the
 * end is for the loop: Instagram cuts straight back to the first frame, and a
 * voice stopping dead at that seam is audible.
 */
export function buildAudioGraph(starts: number[], firstInput: number, total: number): string {
  if (starts.length === 0) return "";
  const parts = starts.map(
    (start, i) => `[${firstInput + i}:a]adelay=delays=${Math.round(start * 1000)}:all=1[a${i}]`
  );
  const mixed = starts.map((_, i) => `[a${i}]`).join("");
  const fadeAt = Math.max(0, total - 0.6).toFixed(3);
  if (starts.length === 1) {
    parts.push(`[a0]afade=t=out:st=${fadeAt}:d=0.6[aout]`);
  } else {
    parts.push(
      `${mixed}amix=inputs=${starts.length}:duration=longest:normalize=0,` +
        `afade=t=out:st=${fadeAt}:d=0.6[aout]`
    );
  }
  return parts.join(";");
}

/** Pull a duration out of whatever ffmpeg printed about the file. */
export function parseDuration(ffmpegOutput: string): number | null {
  const m = ffmpegOutput.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * How long an audio file runs, asked of ffmpeg rather than guessed, so the
 * pictures are cut to the voice that actually came back.
 *
 * The header line has to be read off *both* exit paths. `-f null -` succeeds,
 * so an earlier version of this only looked at the error path and therefore
 * always returned null — every clip silently fell back to the estimate, which
 * is exactly the drift this function exists to remove and would never have
 * shown up as a failure.
 */
async function probeSeconds(file: string): Promise<number | null> {
  if (!ffmpegPath) return null;
  try {
    const { stderr } = await run(ffmpegPath, ["-i", file, "-f", "null", "-"], {
      maxBuffer: 1024 * 1024,
    });
    return parseDuration(String(stderr ?? ""));
  } catch (err) {
    return parseDuration(String((err as { stderr?: string }).stderr ?? ""));
  }
}

/**
 * Compose the sections: what is on screen while each passage is spoken.
 *
 * The count-up sits under the passage that says the figure, so the number is
 * still climbing as the voice lands on it. The sign-off holds the finished card
 * — the same render as the claim beat, so it costs nothing — which gives the
 * end of the clip a beat of stillness to be read in.
 */
export function composeSections(stat: ReelStat, durations: Record<string, number>): Section[] {
  const ticks = countUpFrames(stat.value);
  const withTail = (key: string, last = false) =>
    (durations[key] ?? 0) + (last ? FINAL_TAIL_SECONDS : TAIL_SECONDS);

  const sections: Section[] = [
    { key: "label", frames: [{ reveal: 0 }], seconds: withTail("label") },
    {
      key: "value",
      frames: [
        ...ticks.map((valueText) => ({ reveal: 0.3, valueText, seconds: TICK_SECONDS })),
        { reveal: 0.3 },
      ],
      seconds: withTail("value") + ticks.length * TICK_SECONDS,
    },
  ];
  if (stat.line.trim()) {
    sections.push({ key: "line", frames: [{ reveal: 0.6 }], seconds: withTail("line") });
  }
  if (stat.subtext.trim()) {
    sections.push({ key: "claim", frames: [{ reveal: 1 }], seconds: withTail("claim") });
  }
  sections.push({
    key: "signOff",
    frames: [{ reveal: 1 }],
    seconds: withTail("signOff", true),
  });
  return sections;
}

/**
 * Render a stat card as a narrated MP4 Reel.
 *
 * Returns the encoded bytes. Everything happens in a temp directory that is
 * removed on the way out, including on failure, so a long-running server does
 * not accumulate frames from posts that never went anywhere.
 *
 * If narration is unavailable — no key, a failed call — the clip is still made,
 * silently, with the passages' lengths estimated instead of measured. A silent
 * Reel is worse than a narrated one and better than no post at all, and it is
 * still cut like speech rather than to an arbitrary table.
 */
export async function renderStatReel(
  stat: ReelStat,
  variant: CardVariant = "navy",
  opts: { narrate?: boolean } = {}
): Promise<{ bytes: Buffer; seconds: number; narrated: boolean }> {
  if (!ffmpegPath) throw new Error("ffmpeg binary unavailable");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-reel-"));
  try {
    const script = buildScript(stat);
    const spoken = opts.narrate === false ? null : await synthesiseScript(script);

    // Measure the voice when we have it; fall back to a news-read estimate.
    const durations: Record<string, number> = {};
    const audioFiles: Array<{ key: string; file: string }> = [];
    for (const line of script) {
      durations[line.key] = estimateSpeechSeconds(line.text);
    }
    if (spoken) {
      for (const [i, clip] of spoken.entries()) {
        const file = path.join(dir, `say-${i}.mp3`);
        await fs.writeFile(file, clip.bytes);
        const measured = await probeSeconds(file);
        if (measured) durations[clip.key] = measured;
        audioFiles.push({ key: clip.key, file });
      }
    }

    const sections = composeSections(stat, durations);
    const { beats, starts, total } = layout(sections);

    // One still per beat, all from the same card component. Identical frames
    // are rendered once — the claim beat and the sign-off beat are the same
    // picture, and satori is the expensive part of this function.
    const cache = new Map<string, string>();
    const frameFiles: string[] = [];
    for (const beat of beats) {
      const key = `${beat.frame.reveal}|${beat.frame.valueText ?? ""}`;
      let file = cache.get(key);
      if (!file) {
        const buf = await renderStatCard(stat, variant, {
          shape: "vertical",
          reveal: beat.frame.reveal,
          valueText: beat.frame.valueText,
          kicker: "The Number",
        });
        file = path.join(dir, `frame-${cache.size}.jpg`);
        await fs.writeFile(file, buf);
        cache.set(key, file);
      }
      frameFiles.push(file);
    }

    // Audio inputs follow the stills, so a passage's stream index is its
    // position in the script offset by the number of frames.
    const spokenSections = spoken
      ? sections
          .map((s, i) => ({
            start: starts[i],
            file: audioFiles.find((a) => a.key === s.key)?.file,
          }))
          .filter((s): s is { start: number; file: string } => Boolean(s.file))
      : [];

    const output = path.join(dir, "reel.mp4");
    const args: string[] = ["-y", "-loglevel", "error"];
    // One still per input, never a looped stream — see buildVideoGraph.
    for (const file of frameFiles) args.push("-i", file);
    for (const s of spokenSections) args.push("-i", s.file);

    const graph = [
      buildVideoGraph(beats),
      spokenSections.length
        ? buildAudioGraph(
            spokenSections.map((s) => s.start),
            frameFiles.length,
            total
          )
        : "",
    ]
      .filter(Boolean)
      .join(";");

    args.push("-filter_complex", graph, "-map", "[vout]");
    if (spokenSections.length) {
      // Instagram's transcoder is fussy about audio in a way it is not about
      // video: stereo AAC at 48kHz is what it documents, and a mono 44.1kHz
      // track is a container it may simply refuse.
      args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000");
    }
    args.push(
      "-c:v",
      "libx264",
      // veryfast rather than medium: this material is flat colour and slow
      // motion, so the quality difference is invisible and the encode is a
      // fraction of the time on a small container.
      "-preset",
      "veryfast",
      "-crf",
      "20",
      // yuv420p and the +faststart flag are what make the file play everywhere
      // rather than only in a desktop player; Instagram rejects the rest.
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-r",
      String(FPS),
      "-t",
      total.toFixed(3),
      output
    );

    // The encode measures a few seconds; the ceiling is for a cold container.
    await run(ffmpegPath, args, { timeout: 180_000, maxBuffer: 1024 * 1024 * 32 });
    return {
      bytes: await fs.readFile(output),
      seconds: total,
      narrated: spokenSections.length > 0,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
