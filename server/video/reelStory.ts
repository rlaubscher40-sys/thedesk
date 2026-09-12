import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { loadReelSubtitleFont } from "../og/instagramCards";
import { REEL_SAFE_AREAS } from "./reelSafeAreas";

type Video = {
  bytes: Buffer;
  seconds: number;
  narrated: boolean;
  subtitled: boolean;
  timeline: Array<{ key: string; start: number; seconds: number }>;
};
const run = promisify(execFile);

/** Whole opening/evidence/explanation scenes, followed by the complete takeaway.
 * Never cut a voice passage to an arbitrary teaser duration. */
export function reelStorySegments(video: Pick<Video, "seconds" | "timeline">) {
  const scenes = video.timeline;
  if (
    scenes.length < 4 ||
    scenes[0]?.key !== "label" ||
    scenes.at(-1)?.key !== "signOff" ||
    !Number.isFinite(video.seconds) ||
    video.seconds > 60 ||
    scenes.some(
      (s, i) =>
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.seconds) ||
        s.start < 0 ||
        s.seconds <= 0 ||
        s.start + s.seconds > video.seconds + 0.05 ||
        (i > 0 && s.start < scenes[i - 1]!.start + scenes[i - 1]!.seconds - 0.05)
    )
  )
    throw new Error("Story needs a complete measured Reel timeline.");
  const first = { start: 0, seconds: scenes[3]!.start };
  const last = scenes.at(-1)!;
  const segments = [first, { start: last.start, seconds: video.seconds - last.start }];
  if (segments.reduce((sum, s) => sum + s.seconds, 0) > 35)
    throw new Error("Complete Story passages exceed the reviewed 35-second budget.");
  return segments;
}

export async function renderReelStory(video: Video) {
  if (!video.narrated || !video.subtitled)
    throw new Error("Story requires narrated, subtitled video.");
  if (!ffmpeg) throw new Error("Story encoder unavailable.");
  const segments = reelStorySegments(video);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-reel-story-"));
  try {
    const input = path.join(dir, "reel.mp4"),
      output = path.join(dir, "story.mp4");
    await fs.writeFile(input, video.bytes);
    await fs.writeFile(path.join(dir, "font.ttf"), await loadReelSubtitleFont(true));
    await fs.writeFile(
      path.join(dir, "cta.ass"),
      `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CTA,Desk Editorial Sans,32,&H0067A2C5,&H0067A2C5,&H0017110C,&H0017110C,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:01:00.00,CTA,,0,0,0,,{\\pos(540,${REEL_SAFE_AREAS.storyFooterCentreY})}FULL REEL ON OUR PROFILE
`
    );
    const filters = segments.flatMap((s, i) => [
      `[0:v]trim=start=${s.start}:duration=${s.seconds},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${s.start}:duration=${s.seconds},asetpts=PTS-STARTPTS[a${i}]`,
    ]);
    filters.push("[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]");
    // Fixed text only. Not a fake link or tappable sticker. Kept below subtitles
    // and above the Story reply chrome in the existing 1080x1920 safe area.
    filters.push(
      `[v]drawbox=x=72:y=${REEL_SAFE_AREAS.storyFooterTop}:w=936:h=${REEL_SAFE_AREAS.storyFooterBottom - REEL_SAFE_AREAS.storyFooterTop}:color=0x0c1117@0.95:t=fill,ass=cta.ass:fontsdir=.[out]`
    );
    await run(
      ffmpeg,
      [
        "-y",
        "-i",
        input,
        "-filter_complex",
        filters.join(";"),
        "-map",
        "[out]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        output,
      ],
      { cwd: dir, timeout: 90_000, maxBuffer: 2_000_000 }
    );
    // Fully decode both streams and reject missing/silent audio before upload.
    const { stderr } = await run(
      ffmpeg,
      ["-v", "info", "-i", output, "-af", "volumedetect", "-f", "null", "-"],
      { timeout: 30_000, maxBuffer: 2_000_000 }
    );
    const peak = Number(stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
    if (!Number.isFinite(peak) || peak < -45) throw new Error("Story narration is inaudible.");
    return {
      bytes: await fs.readFile(output),
      seconds: segments.reduce((n, s) => n + s.seconds, 0),
      narrated: true as const,
      subtitled: true as const,
      segments,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
