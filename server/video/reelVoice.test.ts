import { beforeEach, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "xeSYpoWjkR3imzxB6qDk",
  reelVoiceProvider: "auto",
}));
vi.mock("../core/env", () => ({ env: config }));
vi.mock("./localVoice", () => ({
  localSpeech: vi.fn(async (lines: Array<{ key: string }>) =>
    lines.map((l) => ({ key: l.key, bytes: Buffer.from("local") }))
  ),
  localVoiceReady: vi.fn().mockResolvedValue(true),
}));
vi.mock("./elevenLabsVoice", () => ({
  elevenLabsSpeech: vi.fn(async (lines: Array<{ key: string }>) =>
    lines.map((l) => ({ key: l.key, bytes: Buffer.from("clone") }))
  ),
  elevenLabsVoiceReady: vi.fn().mockResolvedValue(true),
}));
import { localSpeech, localVoiceReady } from "./localVoice";
import { elevenLabsSpeech, elevenLabsVoiceReady } from "./elevenLabsVoice";
import { reelSpeech, reelNarration, reelVoiceReadiness, reelVoiceIdentity } from "./reelVoice";
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

it("retains an archived voice identity when today's provider or clone changes", () => {
  config.reelVoiceProvider = "elevenlabs";
  for (const voice of [
    { engine: "local-kokoro" as const, voice: "bm_fable", speed: 1 },
    { engine: "elevenlabs" as const, voice: "previous-clone-id", speed: 1 },
  ]) {
    const record = captureReelRender(
      { bytes: Buffer.from("saved video"), seconds: 10, narrated: true, subtitled: true, voice },
      Buffer.from("cover"),
      { label: "Test", value: "1", line: "Evidence", subtext: "Period" },
      { voice: "bm_daniel", speed: 1.1 }
    );
    expect(record.voice).toEqual(voice);
  }
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

it("speaks locally rather than losing the Reel when the clone fails in auto mode", async () => {
  config.elevenLabsApiKey = "test-key";
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(elevenLabsSpeech).mockRejectedValueOnce(new Error("HTTP 429"));
  const spoken = await reelSpeech(lines);
  expect(spoken.map((c) => c.bytes.toString())).toEqual(["local"]);
  expect(localSpeech).toHaveBeenCalledWith(lines, undefined);
  expect(warn.mock.calls[0]![0]).toContain("speaks in the local voice");
  expect(warn.mock.calls[0]![0]).toContain("HTTP 429");
  warn.mockRestore();
});

it("never mixes two speakers in one Reel when the clone fails part way through", async () => {
  config.elevenLabsApiKey = "test-key";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const first = Array.from({ length: 9 }, (_, i) => ({ key: `a${i}`, text: "One." }));
  const second = [{ key: "b0", text: "Two." }];
  // The opening batch is spoken by the clone, and then the closing batch fails:
  // the state that could put two speakers in one clip.
  vi.mocked(elevenLabsSpeech).mockImplementationOnce(async (batch) =>
    batch.map((l) => ({ key: l.key, bytes: Buffer.from("clone") }))
  );
  vi.mocked(elevenLabsSpeech).mockRejectedValueOnce(new Error("HTTP 500"));
  const { engine, clips } = await reelNarration([first, second]);
  expect(engine).toBe("local-kokoro");
  expect(clips).toHaveLength(10);
  expect(clips.every((c) => c.bytes.toString() === "local")).toBe(true);
  expect(vi.mocked(localSpeech).mock.calls.map((c) => c[0].length)).toEqual([9, 1]);
  vi.mocked(console.warn).mockRestore();
});

it("keeps an explicitly required clone strict, with no local substitute", async () => {
  config.elevenLabsApiKey = "test-key";
  config.reelVoiceProvider = "elevenlabs";
  vi.mocked(elevenLabsSpeech).mockRejectedValueOnce(new Error("HTTP 401"));
  await expect(reelNarration([lines])).rejects.toThrow("HTTP 401");
  expect(localSpeech).not.toHaveBeenCalled();
});

it("reports a readiness state that names the voice a listener would hear", async () => {
  config.elevenLabsApiKey = "test-key";
  vi.mocked(elevenLabsVoiceReady).mockResolvedValueOnce(false);
  const fallingBack = await reelVoiceReadiness();
  expect(fallingBack.ok).toBe(true);
  expect(fallingBack.detail).toContain("not in Ruben's clone");
  // Nothing can speak: the Reel must not publish silently.
  vi.mocked(elevenLabsVoiceReady).mockResolvedValueOnce(false);
  vi.mocked(localVoiceReady).mockResolvedValueOnce(false);
  expect((await reelVoiceReadiness()).ok).toBe(false);
});

it("records the speaker that was actually heard, not the one configured", () => {
  config.reelVoiceProvider = "elevenlabs";
  const profile = { voice: "bm_fable", speed: 1 };
  expect(reelVoiceIdentity(profile, "local-kokoro")).toEqual({
    engine: "local-kokoro",
    voice: "bm_fable",
    speed: 1,
  });
  const record = captureReelRender(
    {
      bytes: Buffer.from("video"),
      seconds: 10,
      narrated: true,
      subtitled: true,
      spokenBy: "local-kokoro",
    },
    Buffer.from("cover"),
    { label: "Test", value: "1", line: "Evidence", subtext: "Period" },
    profile
  );
  expect(record.voice).toEqual({ engine: "local-kokoro", voice: "bm_fable", speed: 1 });
});
