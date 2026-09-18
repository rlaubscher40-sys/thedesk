import { beforeEach, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "xeSYpoWjkR3imzxB6qDk",
  reelVoiceProvider: "auto",
}));
vi.mock("../core/env", () => ({ env: config }));
vi.mock("./localVoice", () => ({
  localSpeech: vi.fn(),
  localVoiceReady: vi.fn().mockResolvedValue(true),
}));
vi.mock("./elevenLabsVoice", () => ({
  elevenLabsSpeech: vi.fn(),
  elevenLabsVoiceReady: vi.fn().mockResolvedValue(true),
}));
import { localSpeech } from "./localVoice";
import { elevenLabsSpeech, elevenLabsVoiceReady } from "./elevenLabsVoice";
import { reelSpeech, reelVoiceReadiness, reelVoiceIdentity } from "./reelVoice";
import { synthesiseScript } from "./narration";
vi.mock("./reelVisualStandard", () => ({ REEL_VISUAL_SEQUENCES: {} }));
import { captureReelRender, reelRenderRecordSchema } from "./reelRenderRecord";
const lines = [{ key: "a", text: "The Desk." }];
it("records the clone identity and still accepts historical local exports", () => {
  config.reelVoiceProvider = "elevenlabs";
  const record = captureReelRender(
    { bytes: Buffer.from("video"), seconds: 10, narrated: true, subtitled: true },
    Buffer.from("cover"),
    { label: "Test", value: "1", line: "Evidence", subtext: "Period" },
    { voice: "bm_fable", speed: 1 }
  );
  expect(record.voice).toEqual({ engine: "elevenlabs", voice: config.elevenLabsVoiceId, speed: 1 });
  expect(
    reelRenderRecordSchema.parse({
      ...record,
      voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    }).voice.engine
  ).toBe("local-kokoro");
});
beforeEach(() => {
  vi.clearAllMocks();
  config.elevenLabsApiKey = "";
  config.reelVoiceProvider = "auto";
});

it("preserves local narration without configuration", async () => {
  await reelSpeech(lines);
  expect(localSpeech).toHaveBeenCalledWith(lines, undefined);
  expect(elevenLabsSpeech).not.toHaveBeenCalled();
});
it("routes regular scripts to the clone when the key is configured", async () => {
  config.elevenLabsApiKey = "test-key";
  await synthesiseScript(lines, { voice: "bm_fable", speed: 1.05 });
  expect(elevenLabsSpeech).toHaveBeenCalledWith(lines, 1.05);
  expect(localSpeech).not.toHaveBeenCalled();
  expect((await reelVoiceReadiness()).detail).toContain("ElevenLabs");
  expect(reelVoiceIdentity({ voice: "bm_fable", speed: 1 })).toEqual({
    engine: "elevenlabs",
    voice: config.elevenLabsVoiceId,
    speed: 1,
  });
});
it("never falls back to a different speaker when ElevenLabs fails", async () => {
  config.reelVoiceProvider = "elevenlabs";
  vi.mocked(elevenLabsSpeech).mockRejectedValueOnce(new Error("Voice inaccessible"));
  await expect(reelSpeech(lines)).rejects.toThrow("Voice inaccessible");
  expect(localSpeech).not.toHaveBeenCalled();
  vi.mocked(elevenLabsVoiceReady).mockResolvedValueOnce(false);
  expect((await reelVoiceReadiness()).ok).toBe(false);
});
it("permits an explicit local rollback and blocks an invalid provider", async () => {
  config.elevenLabsApiKey = "test-key";
  config.reelVoiceProvider = "local";
  await reelSpeech(lines);
  expect(localSpeech).toHaveBeenCalled();
  config.reelVoiceProvider = "typo";
  await expect(reelSpeech(lines)).rejects.toThrow("REEL_VOICE_PROVIDER");
  expect((await reelVoiceReadiness()).ok).toBe(false);
});
