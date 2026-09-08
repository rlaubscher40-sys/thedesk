import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { localVoiceReady } from "./localVoice";

const run = promisify(execFile);

export type ReelReadiness = {
  /** Can a Reel be rendered at all? False means the job should not start. */
  ok: boolean;
  /** The ffmpeg build in use, or null when there isn't one. */
  ffmpegVersion: string | null;
  /** Will it have a voice track? Required for publication. */
  voice: boolean;
  /** One sentence, in plain words, for a human reading a log or a panel. */
  detail: string;
};

/** Pull "7.1" out of ffmpeg's first line, which is otherwise a paragraph of
 *  build flags nobody reading a health panel wants. */
export function parseFfmpegVersion(output: string): string | null {
  return output.match(/ffmpeg version (\S+)/)?.[1] ?? null;
}

/**
 * Check both dependencies. Never throws: a preflight that can fail is a second
 * thing to debug at the moment you are already debugging something.
 */
export async function checkReelReadiness(): Promise<ReelReadiness> {
  const voice = await localVoiceReady();
  const voiceNote = voice
    ? ""
    : " Narration is off: the local voice check failed. Reels will not publish. Run the voice build setup.";

  if (!ffmpegPath) {
    return {
      ok: false,
      ffmpegVersion: null,
      voice,
      detail: "ffmpeg-static resolved no path at all. Reels cannot be rendered." + voiceNote,
    };
  }
  try {
    // Existence first, because this is the failure the postinstall problem
    // actually produces and its error message is much clearer than execFile's.
    await fs.access(ffmpegPath);
  } catch {
    return {
      ok: false,
      ffmpegVersion: null,
      voice,
      detail:
        `ffmpeg-static points at ${ffmpegPath} but nothing is there. Its postinstall ` +
        `download did not run: check that pnpm.onlyBuiltDependencies is in the deployed ` +
        `package.json and re-run the install.` +
        voiceNote,
    };
  }
  try {
    const { stdout } = await run(ffmpegPath, ["-version"], { timeout: 15_000 });
    const version = parseFfmpegVersion(stdout);
    return {
      ok: voice,
      ffmpegVersion: version,
      voice,
      detail:
        `ffmpeg ${version ?? "present"}.` +
        (voiceNote || " Narration is on: local voice produced audible speech; no paid speech API."),
    };
  } catch (err) {
    return {
      ok: false,
      ffmpegVersion: null,
      voice,
      detail:
        `ffmpeg is present at ${ffmpegPath} but would not run: ${(err as Error).message.slice(0, 160)}` +
        voiceNote,
    };
  }
}

/**
 * Say at boot what will happen on Tuesday.
 *
 * A deploy log is the one place somebody looks right after changing something,
 * which makes it the right place for this to be wrong out loud.
 */
export async function logReelReadiness(): Promise<void> {
  const state = await checkReelReadiness();
  if (state.ok) console.log(`[reel] ${state.detail}`);
  else console.error(`[reel] NOT READY. ${state.detail}`);
}
