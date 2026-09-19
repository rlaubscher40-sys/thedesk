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
function response(_url: string, options: { body: string }) {
  const text = JSON.parse(options.body).text as string;
  const characters = Array.from(text);
  return new Response(
    JSON.stringify({
      audio_base64: pcm().toString("base64"),
      alignment: {
        characters,
        character_start_times_seconds: characters.map((_, i) => i / characters.length),
        character_end_times_seconds: characters.map((_, i) => (i + 1) / characters.length),
      },
    })
  );
}
beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

it("uses Ruben's clone and produces WAV compatible with measured phrase subtitles", async () => {
  request.mockImplementation(response);
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  const lines = [
    { key: "a", text: "First sentence." },
    { key: "b", text: "Second sentence." },
  ];
  const audio = await elevenLabsSpeech(lines);
  expect(request.mock.calls[0][0]).toContain(
    "/xeSYpoWjkR3imzxB6qDk/with-timestamps?output_format=pcm_24000"
  );
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body).toMatchObject({
    text: lines.map((l) => l.text).join(" "),
    model_id: "eleven_multilingual_v2",
    voice_settings: { speed: 1, stability: 0.5, similarity_boost: 0.75, style: 0 },
  });
  expect(request).toHaveBeenCalledTimes(1);
  const joined = joinPhraseAudio(
    audio.map((a, i) => ({ ...a, text: lines[i].text })),
    true
  );
  expect(joined.phrases[1].start).toBeCloseTo(0.5, 4);
  expect(joined.bytes.subarray(44)).toEqual(pcm());
  expect(joined.bytes.readUInt32LE(24)).toBe(24000);
  await elevenLabsSpeech(lines);
  expect(request).toHaveBeenCalledTimes(1);
});

it("deduplicates simultaneous reads but regenerates changed scripts and speeds", async () => {
  request.mockImplementation(response);
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
  request.mockImplementation(response);
  const { engine, clips } = await synthesisePhrases([
    { key: "scene", text: "One. Two.", phrases: ["One.", "Two."] },
  ]);
  expect(engine).toBe("elevenlabs");
  expect(clips[0].phrases[1].start).toBeCloseTo(5 / 9, 4);
  expect(clips[0].bytes.subarray(44)).toEqual(pcm());
  expect(request).toHaveBeenCalledTimes(1);
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
    request.mockImplementationOnce(response);
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

it("rejects an incomplete alignment for the whole take", async () => {
  request.mockResolvedValue(
    new Response(
      JSON.stringify({
        audio_base64: pcm().toString("base64"),
        alignment: {
          characters: ["First."],
          character_start_times_seconds: [0],
          character_end_times_seconds: [1],
        },
      })
    )
  );
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  await expect(
    elevenLabsSpeech([
      { key: "a", text: "First." },
      { key: "b", text: "Second." },
    ])
  ).rejects.toThrow("alignment");
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

it("isolates delivery profiles in the cache and never speaks direction metadata", async () => {
  request.mockImplementation(response);
  const { elevenLabsSpeech } = await import("./elevenLabsVoice");
  const lines = [{ key: "a", text: "A turning point. Then another.", protectPauseAfterWords: [2] }];
  const briefing = await elevenLabsSpeech(lines, 1, "briefing");
  const documentary = await elevenLabsSpeech(lines, 1, "documentary");
  expect(request).toHaveBeenCalledTimes(2);
  expect(briefing[0]!.delivery!.profile).toBe("newsreader-v2-briefing");
  expect(documentary[0]!.delivery!.profile).toBe("newsreader-v2-documentary");
  expect(documentary[0]!.delivery!.synthesis).toMatchObject({
    model: "eleven_multilingual_v2",
    voice: config.elevenLabsVoiceId,
    speed: 1,
    stability: 0.5,
  });
  expect(JSON.parse(request.mock.calls[0][1].body).text).toBe(lines[0]!.text);
  expect(request.mock.calls[0][1].body).not.toContain("protectPause");
  await elevenLabsSpeech(lines, 1, "documentary");
  expect(request).toHaveBeenCalledTimes(2);
  await expect(elevenLabsSpeech([{ ...lines[0]!, protectPauseAfterWords: [99] }])).rejects.toThrow(
    "boundary"
  );
  await expect(elevenLabsSpeech(lines, 1, "unknown" as never)).rejects.toThrow("delivery");
  expect(request).toHaveBeenCalledTimes(2);
});

it("maps an authored scene boundary into its second phrase without speaking the direction", async () => {
  request.mockImplementation(response);
  const result = await synthesisePhrases(
    [
      {
        key: "scene",
        text: "The beginning. The turning point. Then the conclusion.",
        phrases: ["The beginning.", "The turning point. Then the conclusion."],
        protectPauseAfterWords: [4],
      },
    ],
    undefined,
    undefined,
    "documentary"
  );
  expect(result.delivery!.boundaries).toContainEqual(
    expect.objectContaining({ afterWord: 4, reason: "directed" })
  );
  expect(result.delivery!.profile).toBe("newsreader-v2-documentary");
  expect(JSON.parse(request.mock.calls[0][1].body).text).toBe(
    "The beginning. The turning point. Then the conclusion."
  );
});
