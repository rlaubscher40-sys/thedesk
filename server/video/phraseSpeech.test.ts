import { expect, it, vi } from "vitest";
import { joinPhraseAudio, synthesisePhrases } from "./phraseSpeech";
import { localSpeech } from "./localVoice";
vi.mock("./localVoice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./localVoice")>()),
  localSpeech: vi.fn(),
}));
function wave(seconds = 1) {
  const b = Buffer.alloc(44 + Math.round(seconds * 24000) * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 44; i < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 10) * 2000), i);
  return b;
}
it("preserves speech samples and measures phrase boundaries including the deliberate pause", () => {
  const first = wave(1),
    second = wave(2);
  const joined = joinPhraseAudio([
    { text: "First.", bytes: first },
    { text: "Second.", bytes: second },
  ]);
  expect(joined.phrases).toEqual([
    { text: "First.", start: 0, seconds: 1 },
    { text: "Second.", start: 1.08, seconds: 2 },
  ]);
  expect(joined.bytes.subarray(44, 48044)).toEqual(first.subarray(44));
  expect(joined.bytes.subarray(48044, 48044 + 3840).every((n) => n === 0)).toBe(true);
  expect(joined.bytes.subarray(48044 + 3840)).toEqual(second.subarray(44));
  expect(joined.bytes.readUInt32LE(40)).toBe(joined.bytes.length - 44);
});
it("rejects corrupt, mismatched and oversized PCM instead of inventing cue times", () => {
  const wrongRate = wave();
  wrongRate.writeUInt32LE(22050, 24);
  for (const bytes of [Buffer.alloc(50), wrongRate])
    expect(() => joinPhraseAudio([{ text: "Test.", bytes }])).toThrow("PCM");
  expect(() =>
    joinPhraseAudio(Array.from({ length: 3 }, () => ({ text: "Long.", bytes: wave(11) })))
  ).toThrow("too long");
});
it("removes only excess edge silence while preserving speech and safety padding", () => {
  const voice = wave();
  const padded = Buffer.concat([
    voice.subarray(0, 44),
    Buffer.alloc(19200),
    voice.subarray(44),
    Buffer.alloc(24000),
  ]);
  padded.writeUInt32LE(padded.length - 8, 4);
  padded.writeUInt32LE(padded.length - 44, 40);
  const joined = joinPhraseAudio([{ text: "A padded sentence.", bytes: padded }]);
  expect(joined.phrases[0]!.seconds).toBeCloseTo(1.26, 2);
  expect(joined.bytes.subarray(44 + 4800, 44 + 4800 + 48000)).toEqual(voice.subarray(44));
});
it("rejects script drift before synthesis and retains the bounded voice batches", async () => {
  vi.mocked(localSpeech).mockClear();
  await expect(
    synthesisePhrases([{ key: "a", text: "Original.", phrases: ["Changed."] }])
  ).rejects.toThrow("preserve");
  expect(localSpeech).not.toHaveBeenCalled();
  vi.mocked(localSpeech).mockImplementation(async (lines) =>
    lines.map((l) => ({ key: l.key, bytes: wave() }))
  );
  const plans = Array.from({ length: 6 }, (_, i) => ({
    key: String(i),
    text: "First. Second.",
    phrases: ["First.", "Second."],
  }));
  const spoken = await synthesisePhrases(plans);
  expect(vi.mocked(localSpeech).mock.calls.map((c) => c[0].length)).toEqual([9, 3]);
  expect(spoken.map((s) => s.key)).toEqual(plans.map((p) => p.key));
  expect(spoken.every((s) => s.phrases[1]!.start === 1.08)).toBe(true);
});
