import { env } from "../core/env";
import { localSpeech, localVoiceReady, type SpeechProfile } from "./localVoice";
import { elevenLabsSpeech, elevenLabsVoiceReady } from "./elevenLabsVoice";

export type SpeechLine = { key: string; text: string };
export type SpeechAudio = { key: string; bytes: Buffer };
/** Which speaker actually produced a render's audio, for its provenance record. */
export type ReelVoiceEngine = "elevenlabs" | "local-kokoro";
export type ReelVoiceIdentity = { engine: ReelVoiceEngine; voice: string; speed: number };
/** One narration: the clips, and who is heard saying them. */
export type ReelNarration = { engine: ReelVoiceEngine; clips: SpeechAudio[] };

function configured(): "auto" | "local" | "elevenlabs" {
  /** An absent setting is the documented default, as in core/env; a wrong value still stops. */
  const value = (env.reelVoiceProvider ?? "").trim() || "auto";
  if (value === "auto" || value === "local" || value === "elevenlabs") return value;
  throw new Error("REEL_VOICE_PROVIDER must be auto, elevenlabs or local.");
}

function provider(): "local" | "elevenlabs" {
  const value = configured();
  if (value === "auto") return env.elevenLabsApiKey ? "elevenlabs" : "local";
  return value;
}

/**
 * May the local voice speak in the clone's place when the clone cannot?
 *
 * Only under `auto`, which asks for the best speaker available. Setting
 * REEL_VOICE_PROVIDER=elevenlabs states that the clone is the requirement, so
 * there the render still fails loudly rather than substituting a speaker.
 */
function fallbackPermitted(): boolean {
  return configured() === "auto";
}

/**
 * Speak every passage of one Reel, with one speaker throughout.
 *
 * The batches exist because the local voice runs nine utterances per child
 * process, but they are a single narration: the speaker is chosen once for the
 * whole set. That is the point of taking them together. A clip that opened in
 * Ruben's voice and closed in a stock one would be worse than either voice
 * alone, so when the clone fails part way through, the passages it already
 * spoke are discarded and the entire narration is re-spoken locally.
 */
export async function reelNarration(
  batches: SpeechLine[][],
  profile?: SpeechProfile
): Promise<ReelNarration> {
  const speakLocally = async (): Promise<ReelNarration> => {
    const clips: SpeechAudio[] = [];
    for (const batch of batches) clips.push(...(await localSpeech(batch, profile)));
    return { engine: "local-kokoro", clips };
  };
  if (provider() === "local") return speakLocally();
  try {
    const clips: SpeechAudio[] = [];
    for (const batch of batches) clips.push(...(await elevenLabsSpeech(batch, profile?.speed)));
    return { engine: "elevenlabs", clips };
  } catch (error) {
    if (!fallbackPermitted()) throw error;
    // Loud on the way past: the Reel still publishes, so this log and the
    // render record are the only places the substitution can be noticed.
    console.warn(
      "[reel] ElevenLabs narration failed, so this Reel speaks in the local voice " +
        `instead of Ruben's clone: ${error instanceof Error ? error.message : String(error)}`
    );
    return speakLocally();
  }
}

/** One batch of passages, for a caller that has a single script. */
export async function reelSpeech(
  lines: SpeechLine[],
  profile?: SpeechProfile
): Promise<SpeechAudio[]> {
  return (await reelNarration([lines], profile)).clips;
}

/**
 * Persist the speaker, rather than a local profile ignored by ElevenLabs.
 *
 * `spokenBy` is who was actually heard, which is not always who was configured:
 * a fallback render is recorded as the local voice that spoke it. Callers
 * without it — a local review command, an older record — read the configuration.
 */
export function reelVoiceIdentity(
  profile: { voice: string; speed: number },
  spokenBy?: ReelVoiceEngine | null
) {
  const engine = spokenBy ?? (provider() === "elevenlabs" ? "elevenlabs" : "local-kokoro");
  return engine === "elevenlabs"
    ? {
        engine: "elevenlabs" as const,
        voice: env.elevenLabsVoiceId,
        speed: profile.speed,
      }
    : { engine: "local-kokoro" as const, ...profile };
}

export async function reelVoiceReadiness(): Promise<{
  ok: boolean;
  detail: string;
}> {
  try {
    if (provider() === "elevenlabs") {
      if (await elevenLabsVoiceReady())
        return {
          ok: true,
          detail:
            "Narration is on: ElevenLabs voice access verified. Speech is validated when rendering.",
        };
      // Say which voice will be heard, not merely that narration works. An
      // operator reading this needs to know the clone is not the one speaking.
      if (fallbackPermitted() && (await localVoiceReady()))
        return {
          ok: true,
          detail:
            "Narration is on but not in Ruben's clone: ElevenLabs voice access failed, so the " +
            "local voice will speak instead. Check ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID " +
            "on the server.",
        };
      return {
        ok: false,
        detail:
          "Narration is off: ElevenLabs voice access failed. Check ELEVENLABS_API_KEY and " +
          "ELEVENLABS_VOICE_ID on the server. Reels will not publish.",
      };
    }
    const ok = await localVoiceReady();
    return {
      ok,
      detail: ok
        ? "Narration is on: local voice produced audible speech."
        : "Narration is off: the local voice check failed. Reels will not publish. Run the voice build setup.",
    };
  } catch {
    return {
      ok: false,
      detail:
        "Narration is off: REEL_VOICE_PROVIDER must be auto, elevenlabs or local. Reels will not publish.",
    };
  }
}
