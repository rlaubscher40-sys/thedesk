import { afterEach, describe, expect, it, vi } from "vitest";
import { auditionOpenAiPhrases, EDITORIAL_VOICE_DIRECTION } from "./openAiVoiceAudition";
const plans = [
  {
    key: "value",
    text: "Brisbane, 4.6 percent. Perth, 5.3 percent.",
    phrases: ["Brisbane, 4.6 percent.", "Perth, 5.3 percent."],
  },
];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("explicit OpenAI voice audition", () => {
  it("does not pretend to use a newer voice without credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(auditionOpenAiPhrases(plans, "cedar")).rejects.toThrow("authorised environment");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps verified words and measures returned PCM for the scene cues", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const pcm = Buffer.alloc(24000);
    for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(2000 * Math.sin(i / 5), i);
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(pcm));
    vi.stubGlobal("fetch", fetch);
    const result = await auditionOpenAiPhrases(plans, "cedar");
    expect(result[0]!.phrases).toHaveLength(2);
    expect(result[0]!.phrases[1]!.start).toBeGreaterThan(0.5);
    expect(result[0]!.phrases.map((p) => p.text)).toEqual(plans[0]!.phrases);
    const request = JSON.parse(fetch.mock.calls[0]![1].body as string);
    expect(request).toMatchObject({
      voice: "cedar",
      model: "gpt-4o-mini-tts",
      input: plans[0]!.phrases[0],
      response_format: "pcm",
      instructions: EDITORIAL_VOICE_DIRECTION,
    });
  });
  it("fails explicitly on API errors or silent audio without falling back", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("private provider detail", { status: 429 }))
    );
    await expect(auditionOpenAiPhrases(plans, "marin")).rejects.toThrow("HTTP 429");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Buffer.alloc(24000)))
    );
    await expect(auditionOpenAiPhrases(plans, "marin")).rejects.toThrow("silent audio");
  });
});
