/**
 * Turning a stat card into a Reel.
 *
 * Reels are the only surface on Instagram that reliably reaches people who do
 * not already follow the account, and this account has never posted one. That
 * is the single biggest gap in its reach, and it does not need a camera: the
 * cards already carry the whole message, they just sit still.
 *
 * ## Why frames from the existing card, and not generated video
 *
 * The obvious reading of a competitor's Reels is "we need AI video". For a
 * publication whose entire claim is that its numbers are real, generated
 * footage is the wrong instinct twice over: it costs money per post, it is
 * unpredictable enough to need a human to approve every one, and it would put
 * invented imagery next to figures whose credibility is the product.
 *
 * The card is already the brand. Animating it costs nothing per post, is
 * deterministic enough to publish unattended, and reuses the design system
 * rather than competing with it. `renderStatCard` grew a `reveal` parameter so
 * the frames come from the same component the grid post uses — one design, two
 * outputs, no drift.
 *
 * ## Why so few rendered frames
 *
 * Satori takes over a second per render at this size, so a 10-second clip at
 * 30fps would be five minutes of rendering per post. Instead one still is
 * rendered per beat and ffmpeg supplies the motion. Same result, a few seconds
 * of work, and the pacing lives in one readable table rather than in a loop.
 *
 * ## Silent on purpose
 *
 * Most feed video is watched muted, and licensed music is a rights problem
 * nobody needs. Everything the clip says, it says on screen.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { type CardVariant, renderStatCard } from "../og/instagramCards";

const run = promisify(execFile);

/** Reels are 9:16. 1080x1920 is what Instagram serves at, so encoding there
 *  avoids a re-scale on their side. */
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

/** 30fps is plenty for a slow push over static type, and halves the encode
 *  against 60 for no visible difference on this material. */
const FPS = 30;

export type ReelStat = {
  label: string;
  value: string;
  line: string;
  subtext: string;
  source?: string | null;
  asOf?: Date | null;
};

/**
 * The clip, as a table.
 *
 * Each beat names how far the card has arrived and how long it holds. The
 * opening beat is deliberately short: a viewer decides in under a second, so
 * the number cannot wait. The closing hold is the longest, because that is when
 * someone reads the claim and decides whether to save it.
 */
const BEATS: Array<{ reveal: number; seconds: number }> = [
  { reveal: 0.0, seconds: 0.6 }, // label alone, the setup
  { reveal: 0.3, seconds: 2.2 }, // the number lands
  { reveal: 0.6, seconds: 2.6 }, // the sentence
  { reveal: 1.0, seconds: 4.6 }, // the claim, and time to read it
];

/** Total clip length. Long enough to read, short enough to loop. */
export const REEL_SECONDS = BEATS.reduce((n, b) => n + b.seconds, 0);

/**
 * Build the ffmpeg filter that turns the stills into motion.
 *
 * Each still gets a slow push and is held for its beat, then the beats are
 * concatenated. The push is what stops it reading as a slideshow: the frame is
 * never quite still, so the eye stays on it.
 *
 * ## The one thing to get right here
 *
 * `zoompan` emits `d` frames FOR EVERY FRAME IT IS GIVEN. Feeding it a stream
 * (`-loop 1 -t 2.2`) therefore multiplies frames catastrophically: the first
 * version of this did that and produced a 118MB file in four and a half
 * minutes, for a ten second clip. Each input here is a single still, so `d` is
 * the beat's length and nothing multiplies. The same clip now encodes in about
 * four seconds at 1.4MB.
 *
 * Exported so the pacing can be asserted without invoking ffmpeg.
 */
export function buildFilterGraph(beats = BEATS): string {
  const parts: string[] = [];
  beats.forEach((beat, i) => {
    const frames = Math.max(1, Math.round(beat.seconds * FPS));
    parts.push(
      `[${i}:v]zoompan=z='min(zoom+0.0007,1.06)':d=${frames}:` +
        `s=${REEL_WIDTH}x${REEL_HEIGHT}:fps=${FPS},setsar=1[v${i}]`
    );
  });
  const inputs = beats.map((_, i) => `[v${i}]`).join("");
  parts.push(`${inputs}concat=n=${beats.length}:v=1:a=0[out]`);
  return parts.join(";");
}

/**
 * Render a stat card as an MP4 Reel.
 *
 * Returns the encoded bytes. Everything happens in a temp directory that is
 * removed on the way out, including on failure, so a long-running server does
 * not accumulate frames from posts that never went anywhere.
 */
export async function renderStatReel(
  stat: ReelStat,
  variant: CardVariant = "navy"
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary unavailable");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-reel-"));
  try {
    // One still per beat, all from the same card component.
    const frames: string[] = [];
    for (const [i, beat] of BEATS.entries()) {
      const buf = await renderStatCard(stat, variant, {
        shape: "vertical",
        reveal: beat.reveal,
        kicker: "The Number",
      });
      const file = path.join(dir, `frame-${i}.jpg`);
      await fs.writeFile(file, buf);
      frames.push(file);
    }

    const output = path.join(dir, "reel.mp4");
    const args: string[] = ["-y", "-loglevel", "error"];
    // One still per input, never a looped stream — see buildFilterGraph.
    for (const file of frames) args.push("-i", file);
    args.push(
      "-filter_complex",
      buildFilterGraph(),
      "-map",
      "[out]",
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
      output
    );

    // The encode measures ~4s; the ceiling is for a cold or contended container.
    await run(ffmpegPath, args, { timeout: 120_000, maxBuffer: 1024 * 1024 * 32 });
    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
