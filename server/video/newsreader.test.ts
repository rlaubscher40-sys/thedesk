import { expect, it } from "vitest";
import { newsreaderClips, type CharacterAlignment } from "./newsreader";
import { joinPhraseAudio } from "./phraseSpeech";
import { subtitleCues } from "./subtitles";
import { newsreaderLayout } from "./statReel";

function fixture(punctuation = ".") {
  const text = `One${punctuation} Two.`;
  const pcm = Buffer.alloc(3 * 48000);
  // Two audible words surrounding a 1-second quiet gap.
  for (let i = 0; i < pcm.length / 2; i++)
    if (i < 24000 || i >= 48000) pcm.writeInt16LE(6000, i * 2);
  const alignment: CharacterAlignment = {
    characters: Array.from(text),
    character_start_times_seconds: [0, 0.3, 0.6, 0.9, 1, 2, 2.3, 2.6, 2.9],
    character_end_times_seconds: [0.3, 0.6, 0.9, 1, 2, 2.3, 2.6, 2.9, 3],
  };
  return {
    pcm,
    alignment,
    lines: [
      { key: "a", text: `One${punctuation}` },
      { key: "b", text: "Two." },
    ],
  };
}

it("tightens only punctuation gaps, keeps word samples intact and concatenates without extra silence", () => {
  const { pcm, alignment, lines } = fixture();
  const original = Buffer.from(pcm);
  const clips = newsreaderClips(lines, pcm, alignment);
  const joined = joinPhraseAudio(
    clips.map((c, i) => ({ ...c, text: lines[i]!.text })),
    true
  );
  expect((joined.bytes.length - 44) / 48000).toBeCloseTo(2.32, 4);
  expect(pcm).toEqual(original); // Cached/raw input is immutable.
  expect(joined.bytes.subarray(44, 44 + 48000)).toEqual(pcm.subarray(0, 48000));
  expect(joined.bytes.subarray(-48000)).toEqual(pcm.subarray(-48000));
  expect(clips[1]!.start).toBeCloseTo(1.32, 4);
  expect(joined.phrases[1]!.start).toBe(clips[1]!.start);
  expect(clips[1]!.words[0]).toMatchObject({ text: "Two.", start: 0 });
  expect(clips[1]!.words[0]!.end).toBeCloseTo(0.9, 8);
  const captions = subtitleCues(
    lines,
    clips.map((c) => ({ ...c, seconds: (c.bytes.length - 44) / 48000 }))
  );
  expect(captions[1]!.start).toBe(clips[1]!.start);
  expect(captions[0]!.end).toBeCloseTo(clips[1]!.start - 0.035, 6);
  const timeline = newsreaderLayout(
    lines.map((l) => ({ key: l.key, seconds: 99, frames: [{ reveal: 1 }] })),
    clips
  );
  expect(timeline.starts).toEqual([0, clips[1]!.start]);
  expect(timeline.total).toBeCloseTo(2.8, 6);
  expect(timeline.beats.reduce((n, b) => n + b.seconds - b.fade, 0)).toBeCloseTo(timeline.total, 8);
});

it("keeps quiet pauses without punctuation and rejects incomplete/invalid timing", () => {
  const f = fixture("x");
  expect(
    Buffer.concat(newsreaderClips(f.lines, f.pcm, f.alignment).map((c) => c.bytes.subarray(44)))
  ).toEqual(f.pcm);
  for (const bad of [
    { ...f.alignment, characters: ["wrong"] },
    { ...f.alignment, character_end_times_seconds: [Infinity] },
    {
      ...f.alignment,
      character_start_times_seconds: f.alignment.character_start_times_seconds.map((v, i) =>
        i === 6 ? 0 : v
      ),
    },
  ])
    expect(() => newsreaderClips(f.lines, f.pcm, bad)).toThrow("alignment");
  expect(() => newsreaderClips(f.lines, Buffer.alloc(f.pcm.length), f.alignment)).toThrow("silent");
});

it("uses spoken word timing rather than text length for caption changes", () => {
  const words = [
    { text: "Short", start: 0.2, end: 0.8 },
    { text: "words", start: 1, end: 1.3 },
    { text: "extraordinary", start: 4, end: 4.7 },
    { text: "ending.", start: 5, end: 5.5 },
  ];
  const script = [{ key: "a", text: words.map((w) => w.text).join(" ") }];
  const cues = subtitleCues(script, [{ key: "a", start: 10, seconds: 6, words }], 15);
  expect(cues[0]!.start).toBe(10.2);
  expect(cues[1]!.start).toBe(14);
  expect(cues[0]!.end).toBeCloseTo(13.965, 5);
  expect(() =>
    subtitleCues(script, [{ key: "a", start: 0, seconds: 6, words: words.slice(1) }])
  ).toThrow("alignment");
});

it("rejects scene-order drift and gaps in continuous narration", () => {
  const f = fixture();
  const clips = newsreaderClips(f.lines, f.pcm, f.alignment);
  const sections = f.lines.map((l) => ({ key: l.key, seconds: 3, frames: [{ reveal: 1 }] }));
  expect(() => newsreaderLayout(sections, [...clips].reverse())).toThrow("order");
  expect(() =>
    newsreaderLayout(
      sections,
      clips.map((c) => ({ ...c, start: c.start + 0.2 }))
    )
  ).toThrow("gap");
});
