import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { joinPhraseAudio, synthesisePhrases } from "./phraseSpeech";

const config = vi.hoisted(() => ({
  elevenLabsApiKey: "test-secret",
  elevenLabsVoiceId: "xeSYpoWjkR3imzxB6qDk",
  reelVoiceProvider: "elevenlabs",
}));
vi.mock("../core/env", () => ({ env: config }));
const request = vi.fn();
function pcm() {
  const b = Buffer.alloc(48000);
  for (let i = 0; i < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 10) * 2000), i);
  return b;
}
beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

it("uses Ruben's clone and produces WAV compatible with measured phrase subtitles", async () => {
  request.mockImplementation(async () => new Response(pcm()));
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  const lines = [
    { key: "a", text: "First sentence." },
    { key: "b", text: "Second sentence." },
  ];
  const audio = await elevenLabsSpeech(lines);
  expect(request.mock.calls[0][0]).toContain("/xeSYpoWjkR3imzxB6qDk?output_format=pcm_24000");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body).toMatchObject({
    text: lines[0].text,
    model_id: "eleven_multilingual_v2",
    next_text: lines[1].text,
  });
  expect(JSON.parse(request.mock.calls[1][1].body).previous_text).toBe(lines[0].text);
  const joined = joinPhraseAudio(audio.map((a, i) => ({ text: lines[i].text, bytes: a.bytes })));
  expect(joined.phrases.map((p) => p.start)).toEqual([0, 1.08]);
  expect(joined.bytes.readUInt32LE(24)).toBe(24000);
  await elevenLabsSpeech(lines);
  expect(request).toHaveBeenCalledTimes(2);
});

it("deduplicates simultaneous reads but regenerates changed scripts and speeds", async () => {
  request.mockImplementation(async () => new Response(pcm()));
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  const lines = [{ key: "a", text: "Original number." }];
  const results = await Promise.all([elevenLabsSpeech(lines), elevenLabsSpeech(lines)]);
  expect(results[0]).toBe(results[1]);
  expect(request).toHaveBeenCalledTimes(1);
  await elevenLabsSpeech([{ key: "a", text: "Changed number." }]);
  await elevenLabsSpeech(lines, 1.05);
  expect(request).toHaveBeenCalledTimes(3);
});

it("routes documentary phrases to ElevenLabs while preserving measured cues", async () => {
  request.mockImplementation(async () => new Response(pcm()));
  const { engine, clips } = await synthesisePhrases([
    { key: "scene", text: "One. Two.", phrases: ["One.", "Two."] },
  ]);
  expect(engine).toBe("elevenlabs");
  expect(clips[0].phrases.map((p) => p.start)).toEqual([0, 1.08]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.every(([url]) => new URL(url).hostname === "api.elevenlabs.io")).toBe(
    true
  );
});

it.each([401, 403, 429, 500])(
  "fails the whole script on HTTP %s without leaking response content or caching failure",
  async (status) => {
    request.mockResolvedValueOnce(new Response("sensitive upstream body", { status }));
    const { elevenLabsSpeech } = await import("./elevenLabsVoice");
    const lines = [{ key: "a", text: "A sentence." }];
    await expect(elevenLabsSpeech(lines)).rejects.toThrow(`HTTP ${status}`);
    request.mockResolvedValueOnce(new Response(pcm()));
    expect(await elevenLabsSpeech(lines)).toHaveLength(1);
  }
);

it.each([Buffer.alloc(0), Buffer.alloc(48000), Buffer.alloc(301), Buffer.alloc(1440002)])(
  "rejects empty, silent, malformed or oversized speech",
  async (bytes) => {
    request.mockResolvedValue(new Response(bytes));
    const { elevenLabsSpeech } = await import("./elevenLabsVoice");
    await expect(elevenLabsSpeech([{ key: "a", text: "A sentence." }])).rejects.toThrow();
  }
);

it("does not return partial narration when a later passage fails", async () => {
  request.mockResolvedValueOnce(new Response(pcm())).mockRejectedValueOnce(new Error("Timed out"));
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  await expect(
    elevenLabsSpeech([
      { key: "a", text: "First." },
      { key: "b", text: "Second." },
    ])
  ).rejects.toThrow("Timed out");
});

it("checks voice access without spending speech credits and caches the probe", async () => {
  request.mockResolvedValue(new Response("{}"));
  const { elevenLabsVoiceReady } = await import("./elevenLabsVoice");
  expect(await elevenLabsVoiceReady()).toBe(true);
  expect(await elevenLabsVoiceReady()).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toContain("/v1/voices/xeSYpoWjkR3imzxB6qDk");
  expect(request.mock.calls[0][1].method).toBeUndefined();
});

it("rejects invalid scripts before any paid request", async () => {
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  for (const lines of [[], [{ key: "a", text: " " }], [{ key: "a", text: "x".repeat(1001) }]])
    await expect(elevenLabsSpeech(lines)).rejects.toThrow();
  await expect(elevenLabsSpeech([{ key: "a", text: "Hello." }], NaN)).rejects.toThrow("speed");
  expect(request).not.toHaveBeenCalled();
});
