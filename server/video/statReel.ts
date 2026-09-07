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
import { formatLike, parseFigure } from "../og/figureFormat";
import type { SparkPoint } from "../og/sparkline";
import type { StatFact } from "../metrics/statFacts";
import {
  buildScript,
  estimateSpeechSeconds,
  synthesiseScript,
  type ReelStatText,
  type ScriptLine,
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
 * Round a duration to whole frames.
 *
 * Every beat has to be snapped to the frame grid before any of the timeline
 * arithmetic runs, and the reason is not tidiness. `zoompan` emits a whole
 * number of frames, so a beat asked for 0.075s becomes two frames — 0.0667s.
 * Compute the cross-dissolve offsets from the requested figures and each one
 * sits slightly past where the stream it is cutting from actually ends. The
 * error compounds down the chain, and `xfade` given an offset beyond its first
 * input does not fail: it silently emits almost nothing. A thirty-four beat
 * clip that should have run 18.6 seconds came out at 5.9, with no warning from
 * ffmpeg at all.
 *
 * So durations are frames from here on, and seconds only where ffmpeg needs a
 * number.
 */
export function snapToFrame(seconds: number): number {
  return Math.max(1, Math.round(seconds * FPS)) / FPS;
}

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
// Small. Glasshouse's clip is completely still and reads as more confident for
// it, not less; a push big enough to notice also drags the history line across
// the frame while it is trying to be read. This is here to keep the frame from
// feeling frozen during a four-second hold, and for nothing else.
const ZOOM_END = 1.032;

/** Cross-dissolve between passages, and the much faster one between the ticks
 *  of the count-up, where a dissolve is what stops the digits from strobing. */
/** Ten frames. Written in frames because everything downstream is: a fade the
 *  grid has to round is a fade whose real length is not the one in the file. */
const SECTION_FADE = 10 / FPS;
/**
 * One frame, which is deliberate: this reads as a cut with the hard edge taken
 * off it. At the 0.05s it started at, more than half of each tick was dissolve,
 * and because Playfair's "1" is a third narrower than its other digits the two
 * figures do not sit on top of each other — they smear sideways. A counter that
 * smears looks broken, not fast.
 */
const TICK_FADE = 1 / FPS;

/**
 * How long the frame holds on the metric's name alone before the count begins.
 *
 * Short, and fixed rather than tied to the narration. This is the only part of
 * the clip where nothing is on screen but a label, and every extra tenth of a
 * second here is spent on the frame a viewer is deciding whether to scroll past.
 */
const OPENING_SECONDS = 0.7;

/** Ticks in the count-up. Each one is a full card render, so this is the knob
 *  that trades render time against how smooth the counter looks. */
const COUNT_TICKS = 12;
/** Two frames each. */
const TICK_SECONDS = 2 / FPS;

/** Silence after each passage, so the voice does not run into itself. The last
 *  one is longer because the clip loops, and looping straight out of a word is
 *  the thing that makes a Reel feel like an accident. */
const TAIL_SECONDS = 0.32;
const FINAL_TAIL_SECONDS = 0.85;

/** No beat is shorter than this once the count-up ticks are taken out, so a
 *  short passage never leaves a frame on screen too briefly to read. */
const MIN_HOLD = 0.55;

/**
 * The longest a Reel may run.
 *
 * Every beat holds for as long as its passage takes to say, so the clip's
 * length is whatever the script's length is — and the script is written by a
 * model. Per-passage caps bound it in the normal case; this bounds it in the
 * case where they were set wrong, which has already happened once. Over this,
 * the written script is dropped for the deterministic read, which is short by
 * construction.
 *
 * Thirty-two seconds: long enough for a narrated explainer, short enough that
 * someone finishes it.
 */
export const MAX_REEL_SECONDS = 32;

export type ReelStat = ReelStatText & {
  asOf?: Date | null;
  series?: SparkPoint[];
  facts?: StatFact[];
};

/**
 * The floor on how long each supporting figure holds before the next arrives.
 *
 * A floor rather than a fixed length: the passage explaining these figures is
 * the one that has to teach the viewer something, so when the voice runs longer
 * than the figures need, the figures wait for it.
 */
const FACT_SECONDS = 1.25;

/** How many stills the history line is drawn across. Eight is the point where
 *  the line stops reading as steps; past it, each extra frame is another second
 *  of satori for motion nobody can see. */
const DRAW_STEPS = 8;

export type Frame = {
  reveal: number;
  valueText?: string;
  /** 0..1, how much of the history line is drawn on this frame. */
  seriesProgress?: number;
  /** How many supporting figures have arrived on this frame. */
  factsShown?: number;
  seconds?: number;
};
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
  const shape = parseFigure(value);
  if (!shape) return [];
  const target = shape.value;
  if (target === 0) return [];

  const digits = Math.floor(Math.abs(target)).toString().length;
  // Smallest number with the same integer width: 4.3 starts at 1.0, 815,439
  // starts at 100,000. Same character count, so nothing reflows.
  const start = Math.sign(target) * Math.pow(10, digits - 1);
  const format = (n: number) => formatLike(shape, n);

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
    if (section.frames.length === 0) continue;
    firstBeatOfSection.push(beats.length);

    // A frame with its own `seconds` is fixed — the count-up ticks, which have
    // to be fast whatever else is happening. Everything else shares what is
    // left of the section equally, which is what spreads the history line's
    // eight drawing frames evenly across a passage instead of running them off
    // in half a second and then holding.
    const fixedTotal = section.frames.reduce((n, f) => n + (f.seconds ?? 0), 0);
    const elastic = section.frames.filter((f) => f.seconds === undefined).length;
    // The floor is on the shared total, not on each frame: a drawing frame is
    // animation and does not need to be readable on its own.
    const share = elastic > 0 ? Math.max(MIN_HOLD, section.seconds - fixedTotal) / elastic : 0;

    section.frames.forEach((frame, i) => {
      const fade = beats.length === 0 ? 0 : i === 0 ? SECTION_FADE : TICK_FADE;
      const seconds = snapToFrame(frame.seconds ?? share);
      beats.push({
        frame,
        seconds,
        // The first beat of a section dissolves from the previous section; the
        // frames within it dissolve from each other, much faster. A dissolve
        // can never be as long as the beat it is arriving into — xfade rejects
        // that outright — so a very short beat gets a shorter dissolve.
        fade: fade === 0 ? 0 : Math.min(snapToFrame(fade), seconds - 1 / FPS),
      });
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
 * Roughly how long a script's clip will run, before anything is synthesised.
 *
 * The tails and the count-up are the fixed overhead every clip carries on top
 * of the speech itself; they are what makes a twenty-two second script a
 * twenty-seven second Reel.
 */
export function estimateScriptSeconds(script: ScriptLine[]): number {
  const speech = script.reduce((n, line) => n + estimateSpeechSeconds(line.text), 0);
  const tails = TAIL_SECONDS * Math.max(0, script.length - 1) + FINAL_TAIL_SECONDS;
  return speech + tails + COUNT_TICKS * TICK_SECONDS;
}

/** Will this script produce a Reel anyone finishes? */
export function scriptFitsClip(script: ScriptLine[]): boolean {
  return estimateScriptSeconds(script) <= MAX_REEL_SECONDS;
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

  // The history line draws across the two passages that argue from it — the
  // sentence and the claim — reaching the live reading exactly as the claim
  // about it lands. Without a series those are one still each.
  const drawing = (stat.series?.length ?? 0) >= 6;
  const drawFrames = (reveal: number, from: number, to: number): Frame[] =>
    drawing
      ? Array.from({ length: DRAW_STEPS }, (_, i) => ({
          reveal,
          seriesProgress: from + ((to - from) * (i + 1)) / DRAW_STEPS,
        }))
      : [{ reveal }];

  // The count-up belongs to the OPENING passage, not to the one that says the
  // figure. A viewer decides inside a second, and once the hook was written by
  // a model rather than read off the card it ran three seconds — three seconds
  // of a frame holding nothing but a metric's name, which is the worst opening
  // available. The number now starts climbing under the hook and is on screen
  // by about a second and a half, whatever the hook's length.
  const sections: Section[] = [
    {
      key: "label",
      frames: [
        { reveal: 0, seconds: OPENING_SECONDS },
        ...ticks.map((valueText) => ({ reveal: 0.3, valueText, seconds: TICK_SECONDS })),
        { reveal: 0.3 },
      ],
      seconds: withTail("label") + OPENING_SECONDS + ticks.length * TICK_SECONDS,
    },
    { key: "value", frames: [{ reveal: 0.3 }], seconds: withTail("value") },
  ];
  if (stat.line.trim()) {
    sections.push({
      key: "line",
      frames: drawFrames(0.6, 0, 0.55),
      seconds: withTail("line"),
    });
  }
  if (stat.subtext.trim()) {
    sections.push({ key: "claim", frames: drawFrames(1, 0.55, 1), seconds: withTail("claim") });
  }
  // The supporting figures, one at a time over the finished chart. This is the
  // density beat, and the only one paced by a constant rather than by a voice.
  const facts = stat.facts ?? [];
  if (facts.length > 0) {
    sections.push({
      key: "facts",
      frames: facts.map((_, i) => ({
        reveal: 1,
        seriesProgress: drawing ? 1 : undefined,
        factsShown: i + 1,
      })),
      // Long enough for every figure to be read, and longer still if the
      // narration explaining them runs past that.
      seconds: Math.max(facts.length * FACT_SECONDS, withTail("facts")),
    });
  }

  sections.push({
    key: "signOff",
    frames: [
      {
        reveal: 1,
        seriesProgress: drawing ? 1 : undefined,
        factsShown: facts.length || undefined,
      },
    ],
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
  opts: { narrate?: boolean; script?: ScriptLine[] } = {}
): Promise<{ bytes: Buffer; seconds: number; narrated: boolean }> {
  if (!ffmpegPath) throw new Error("ffmpeg binary unavailable");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-reel-"));
  try {
    // A written script when the caller generated one, the deterministic read
    // otherwise. Rendering stays a pure function of the script it is handed,
    // which is what keeps the model call out of the video path and testable
    // separately from it.
    //
    // The length check runs on the estimate, before synthesis, so an overlong
    // script costs nothing rather than five TTS calls that are then discarded.
    let script = opts.script ?? buildScript(stat);
    if (opts.script && !scriptFitsClip(opts.script)) {
      console.warn(
        `[reel] written script would run ${estimateScriptSeconds(opts.script).toFixed(1)}s; ` +
          `using the plain read instead.`
      );
      script = buildScript(stat);
    }
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
      const key = [
        beat.frame.reveal,
        beat.frame.valueText ?? "",
        beat.frame.seriesProgress ?? "",
        beat.frame.factsShown ?? "",
      ].join("|");
      let file = cache.get(key);
      if (!file) {
        const buf = await renderStatCard(stat, variant, {
          shape: "vertical",
          reveal: beat.frame.reveal,
          valueText: beat.frame.valueText,
          seriesProgress: beat.frame.seriesProgress,
          facts: stat.facts,
          factsShown: beat.frame.factsShown ?? 0,
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
