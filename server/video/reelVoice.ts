import { env } from "../core/env";
import { localSpeech, localVoiceReady, type SpeechProfile } from "./localVoice";
import { elevenLabsSpeech, elevenLabsVoiceReady } from "./elevenLabsVoice";

function provider(): "local" | "elevenlabs" {
  /** An absent setting is the documented default, as in core/env; a wrong value still stops. */
  const configured = (env.reelVoiceProvider ?? "").trim() || "auto";
  if (configured === "auto") return env.elevenLabsApiKey ? "elevenlabs" : "local";
  if (configured === "local" || configured === "elevenlabs") return configured;
  throw new Error("REEL_VOICE_PROVIDER must be auto, elevenlabs or local.");
}

export async function reelSpeech(
  lines: Array<{ key: string; text: string }>,
  profile?: SpeechProfile
) {
  return provider() === "elevenlabs"
    ? elevenLabsSpeech(lines, profile?.speed)
    : localSpeech(lines, profile);
}

/** Persist the selected speaker, rather than a local profile ignored by ElevenLabs. */
export function reelVoiceIdentity(profile: { voice: string; speed: number }) {
  return provider() === "elevenlabs"
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
      const ok = await elevenLabsVoiceReady();
      return {
        ok,
        detail: ok
          ? "Narration is on: ElevenLabs voice access verified. Speech is validated when rendering."
          : "Narration is off: ElevenLabs voice access failed. Check ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server. Reels will not publish.",
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
