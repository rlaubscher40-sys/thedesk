/** Animated property cards with a required, locally generated voice track. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { type CardVariant, renderStatCard, loadReelSubtitleFont } from "../og/instagramCards";
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

import { subtitleCues, subtitleAss } from "./subtitles";
import { housingBalanceSubtitleScript } from "./housingBalanceStoryboard";
import { synthesisePhrases, type MeasuredPhrase } from "./phraseSpeech";
import {
  renderStoryFrame,
  storyboardSections,
  validateStoryboard,
  type ReelStoryboard,
} from "./storyboard";
import type { SpeechProfile } from "./localVoice";

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

/** Default duration budget. The reviewed housing explainer gets six extra
 * seconds for complete sentences and its source passage, without speeding up
 * the voice. This is an editorial limit, not a claim about audience retention. */
export const MAX_REEL_SECONDS = 32;
export function reelDurationLimit(stat?: Pick<ReelStat, "storyboard">): number {
  return stat?.storyboard?.kind === "housing-balance" ? 38 : MAX_REEL_SECONDS;
}

export type ReelStat = ReelStatText & {
  storyboard?: ReelStoryboard;
  editorialLabel?: "What Changed" | "Before You Buy" | "Supply and Demand";
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
  /** Numeric animation uses crisp cuts so adjacent digits never ghost. */
  hardCut?: boolean;
  sceneKey?: string;
  sceneProgress?: number;
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
      const fade = beats.length === 0 || frame.hardCut ? 0 : i === 0 ? SECTION_FADE : TICK_FADE;
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

  // A dissolve consumes wall-clock time. Restore that time to the final
  // still of each section, including the fade into the next section. Without
  // this, a multi-frame facts/chart section can start the next voice early.
  const active = sections.filter((section) => section.frames.length > 0);
  firstBeatOfSection.forEach((first, i) => {
    const next = firstBeatOfSection[i + 1] ?? beats.length;
    let span = 0;
    for (let j = first; j < next; j++)
      span += beats[j]!.seconds - (j === first ? 0 : beats[j]!.fade);
    span -= beats[next]?.fade ?? 0;
    const missing = active[i]!.seconds - span;
    if (missing > 0) beats[next - 1]!.seconds += Math.ceil(missing * FPS - 1e-8) / FPS;
  });

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
export function buildVideoGraph(beats: Beat[], stationary = false): string {
  const total = beats.reduce((n, b, i) => n + b.seconds - (i === 0 ? 0 : b.fade), 0);
  const parts: string[] = [];

  // Each beat's zoom slice is taken from where it sits on the finished
  // timeline, so the ramp is continuous across cuts rather than restarting.
  let chain = 0;
  const spans = beats.map((beat, i) => {
    const startAt = i === 0 ? 0 : chain - beat.fade;
    chain = i === 0 ? beat.seconds : chain + beat.seconds - beat.fade;
    const at = (t: number) =>
      stationary ? 1 : ZOOM_START + (ZOOM_END - ZOOM_START) * (total > 0 ? t / total : 0);
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
    // xfade with a zero-duration, one-frame input can silently end the video
    // stream early. A hard cut must use concat, then restore the input timebase
    // so a later non-zero dissolve still receives compatible streams.
    parts.push(
      beat.fade === 0
        ? `${label}[v${i}]concat=n=2:v=1:a=0,settb=1/${FPS}${out}`
        : `${label}[v${i}]xfade=transition=fade:duration=${beat.fade.toFixed(3)}:` +
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
export function scriptFitsClip(script: ScriptLine[], stat?: Pick<ReelStat, "storyboard">): boolean {
  return estimateScriptSeconds(script) <= reelDurationLimit(stat);
}

/**
 * Compose the sections: what is on screen while each passage is spoken.
 *
 * The count-up sits under the passage that says the figure, so the number is
 * still climbing as the voice lands on it. The sign-off holds the finished card
 * — the same render as the claim beat, so it costs nothing — which gives the
 * end of the clip a beat of stillness to be read in.
 */
export function composeSections(
  stat: ReelStat,
  durations: Record<string, number>,
  phrases?: Record<string, MeasuredPhrase[]>
): Section[] {
  if (stat.storyboard) return storyboardSections(stat.storyboard, durations, phrases);
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
      seconds: Math.max(
        withTail("label"),
        OPENING_SECONDS + ticks.length * TICK_SECONDS + MIN_HOLD
      ),
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
 * Narration is required unless a caller explicitly requests a silent layout preview.
 */
export async function renderStatReel(
  stat: ReelStat,
  variant: CardVariant = "navy",
  opts: {
    narrate?: boolean;
    script?: ScriptLine[];
    subtitles?: boolean;
    voice?: SpeechProfile;
  } = {}
): Promise<{
  bytes: Buffer;
  seconds: number;
  narrated: boolean;
  subtitled: boolean;
  timeline: Array<{ key: string; start: number; seconds: number; phrases?: MeasuredPhrase[] }>;
}> {
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
    let script =
      opts.script ??
      (stat.storyboard
        ? stat.storyboard.scenes.map(({ key, text }) => ({ key, text }))
        : buildScript(stat));
    if (stat.storyboard) validateStoryboard(stat.storyboard, script);
    const maxSeconds = reelDurationLimit(stat);
    if (opts.script && !scriptFitsClip(opts.script, stat)) {
      throw new Error(
        `Narration script exceeds the ${maxSeconds}-second editorial limit. Shorten the story before publishing.`
      );
    }
    const spoken =
      opts.narrate === false
        ? null
        : stat.storyboard?.kind === "housing-balance"
          ? await synthesisePhrases(stat.storyboard.scenes, opts.voice)
          : await synthesiseScript(script, opts.voice);
    if (opts.narrate !== false && !spoken)
      throw new Error("Narration unavailable. No silent Reel was produced.");

    // Measure the voice when we have it; fall back to a news-read estimate.
    const durations: Record<string, number> = {};
    const phrases: Record<string, MeasuredPhrase[]> = {};
    const audioFiles: Array<{ key: string; file: string }> = [];
    for (const line of script) {
      durations[line.key] = estimateSpeechSeconds(line.text);
    }
    if (spoken) {
      for (const [i, clip] of spoken.entries()) {
        const file = path.join(dir, `say-${i}.wav`);
        await fs.writeFile(file, clip.bytes);
        const measured = await probeSeconds(file);
        if (!measured) throw new Error("Narration duration could not be verified.");
        durations[clip.key] = measured;
        if ("phrases" in clip) phrases[clip.key] = clip.phrases as MeasuredPhrase[];
        audioFiles.push({ key: clip.key, file });
      }
    }

    const sections = composeSections(
      stat,
      durations,
      spoken && stat.storyboard?.kind === "housing-balance" ? phrases : undefined
    );
    const { beats, starts, total } = layout(sections);
    if (total > maxSeconds)
      throw new Error(
        `Recorded narration is ${total.toFixed(1)} seconds, exceeding the ${maxSeconds}-second Reel limit. Shorten the story before publishing.`
      );

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
        beat.frame.sceneKey ?? "",
        beat.frame.sceneProgress ?? "",
      ].join("|");
      let file = cache.get(key);
      if (!file) {
        const buf = stat.storyboard
          ? await renderStoryFrame(
              stat.storyboard,
              beat.frame.sceneKey!,
              beat.frame.sceneProgress!,
              variant
            )
          : await renderStatCard(stat, variant, {
              shape: "vertical",
              reveal: beat.frame.reveal,
              valueText: beat.frame.valueText,
              seriesProgress: beat.frame.seriesProgress,
              facts: stat.facts,
              factsShown: beat.frame.factsShown ?? 0,
              subtitleSpace: opts.subtitles,
              kicker: stat.editorialLabel ?? "The Number",
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

    let subtitleFilter = "";
    if (opts.subtitles) {
      if (!spoken) throw new Error("Subtitles require measured narration.");
      const display =
        stat.storyboard?.kind === "housing-balance"
          ? housingBalanceSubtitleScript(stat.storyboard, script)
          : undefined;
      const cues = subtitleCues(
        display
          ? display.flatMap((s) => s.phrases.map((text, i) => ({ key: `${s.key}:${i}`, text })))
          : script,
        display
          ? sections.flatMap((s, i) =>
              (phrases[s.key] ?? []).map((p, j) => ({
                key: `${s.key}:${j}`,
                start: starts[i]! + p.start,
                seconds: p.seconds,
              }))
            )
          : sections.map((section, i) => ({
              key: section.key,
              start: starts[i]!,
              seconds: durations[section.key] ?? 0,
            }))
      );
      const fontDir = path.join(dir, "fonts");
      await fs.mkdir(fontDir);
      await fs.writeFile(
        path.join(fontDir, "JetBrainsMono-Regular.woff"),
        await loadReelSubtitleFont()
      );
      const assFile = path.join(dir, "subtitles.ass");
      await fs.writeFile(assFile, subtitleAss(cues, stat.storyboard ? "story" : "card"));
      subtitleFilter = `[vplain]ass=filename=${assFile}:fontsdir=${fontDir}[vout]`;
    }
    const graph = [
      opts.subtitles
        ? buildVideoGraph(beats, Boolean(stat.storyboard)).replace(/\[vout\]$/, "[vplain]")
        : buildVideoGraph(beats, Boolean(stat.storyboard)),
      subtitleFilter,
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

    args.push("-filter_complex_threads", "1", "-filter_complex", graph, "-map", "[vout]");
    if (spokenSections.length) {
      // Instagram's transcoder is fussy about audio in a way it is not about
      // video: stereo AAC at 48kHz is what it documents, and a mono 44.1kHz
      // track is a container it may simply refuse.
      args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000");
    }
    args.push(
      "-c:v",
      "libx264",
      // Bound native parallelism on the shared host; large filter graphs must
      // not create hundreds of threads alongside speech and scheduled jobs.
      "-threads",
      "2",
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
    // A successful encode can still contain a truncated video stream while
    // audio continues. Measure decoded picture duration, not container duration.
    const decoded = await run(
      ffmpegPath,
      [
        "-v",
        "error",
        "-i",
        output,
        "-map",
        "0:v:0",
        "-an",
        "-f",
        "null",
        "-",
        "-progress",
        "pipe:1",
      ],
      { timeout: 60_000, maxBuffer: 1024 * 1024 }
    );
    const times = [...decoded.stdout.matchAll(/^out_time_us=(\d+)$/gm)];
    const actual = Number(times.at(-1)?.[1]) / 1_000_000;
    if (!Number.isFinite(actual) || Math.abs(actual - total) > 2 / FPS)
      throw new Error("Encoded pictures do not cover the complete measured Reel timeline.");
    return {
      bytes: await fs.readFile(output),
      seconds: total,
      narrated: spokenSections.length > 0,
      subtitled: Boolean(subtitleFilter),
      timeline: sections.map((s, i) => ({
        key: s.key,
        start: starts[i]!,
        seconds: durations[s.key]!,
        ...(phrases[s.key] ? { phrases: phrases[s.key] } : {}),
      })),
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
