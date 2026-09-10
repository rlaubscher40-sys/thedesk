import { expect, it } from "vitest";
import { captionChunks, subtitleAss, subtitleCues } from "./subtitles";

it("retains every word and figure in a bounded two-line layout", () => {
  const text =
    "Year to July 2026. That's the pace of change, not how expensive rents are. The gap is 0.7 percentage points.";
  const chunks = captionChunks(text);
  expect(chunks.flat().join(" ")).toBe(text);
  expect(chunks.every((c) => c.length <= 2 && c.every((l) => l.length <= 32))).toBe(true);
  expect(() => captionChunks("a".repeat(33))).toThrow("readable");
});
it("anchors cues to actual passage starts and ends without spanning silence", () => {
  const script = [
    {
      key: "claim",
      text: "Year to July 2026. That's the pace of change, not how expensive rents are.",
    },
    { key: "facts", text: "Compare prices and costs too." },
  ];
  const cues = subtitleCues(script, [
    { key: "claim", start: 10, seconds: 6 },
    { key: "facts", start: 17, seconds: 2 },
  ]);
  expect(cues[0]!.start).toBe(10);
  expect(cues[1]!.end).toBe(16);
  expect(cues.at(-1)!.start).toBe(17);
  expect(cues.at(-1)!.end).toBe(19);
  expect(cues.flatMap((c) => c.lines).join(" ")).toBe(script.map((l) => l.text).join(" "));
});
it("rejects missing/duplicated timing, overlapping speech and unreadable pacing", () => {
  const script = [
    { key: "a", text: "First sentence." },
    { key: "b", text: "Second sentence." },
  ];
  expect(() => subtitleCues(script, [])).toThrow("verified audio");
  expect(() => subtitleCues([script[0]!, script[0]!], [])).toThrow("duplicated");
  expect(() =>
    subtitleCues(script, [
      { key: "a", start: 0, seconds: 3 },
      { key: "b", start: 2, seconds: 3 },
    ])
  ).toThrow("overlap");
  expect(() => subtitleCues([script[0]!], [{ key: "a", start: 0, seconds: 0.1 }])).toThrow("pace");
  expect(() => subtitleCues([script[0]!], [{ key: "a", start: NaN, seconds: 1 }])).toThrow(
    "timing"
  );
});
it("writes exact cue times and prevents script text becoming ASS commands", () => {
  const out = subtitleAss([
    { start: 1.25, end: 3.6, lines: ["0.7 percentage points.", "{\\pos(0,0)}"] },
  ]);
  expect(out).toContain("0:00:01.25,0:00:03.60");
  expect(out).toContain("0.7 percentage points.\\N");
  expect(out).not.toContain("{\\pos(0,0)}");
  expect(out).toContain("{\\pos(540,210)}");
});

it("balances long phrases and trims only frame-rounding overlaps", () => {
  const text = "A buyer still needs purchase prices and costs to compare returns.";
  const cues = subtitleCues(
    [
      { key: "a", text },
      { key: "b", text: "Next." },
    ],
    [
      { key: "a", start: 0, seconds: 4 },
      { key: "b", start: 3.98, seconds: 1 },
    ]
  );
  expect(cues.every((c) => c.end - c.start >= 0.6)).toBe(true);
  expect(cues.flatMap((c) => c.lines).join(" ")).toBe(text + " Next.");
  expect(cues[cues.length - 2]!.end).toBe(3.98);
});

it("keeps the housing counts together across timed subtitle cues", () => {
  for (const number of [
    "two hundred and thirty-two thousand",
    "two hundred and eighty-seven thousand",
  ]) {
    const text = `After demolitions, about ${number} homes were added.`;
    const cues = subtitleCues([{ key: "value", text }], [{ key: "value", start: 0, seconds: 5.5 }]);
    expect(cues.some((c) => c.lines.join(" ").includes(number))).toBe(true);
    expect(cues.flatMap((c) => c.lines).join(" ")).toBe(text);
    expect(cues.every((c) => c.lines.length <= 2 && c.lines.every((l) => l.length <= 32))).toBe(
      true
    );
    expect(cues.every((c) => c.end - c.start >= 0.6)).toBe(true);
  }
});

it("uses the bundled editorial sans face for documentary captions and keeps their safe position", () => {
  const cues = [{ start: 0, end: 2, lines: ["Homes added must outpace new need."] }];
  const out = subtitleAss(cues, "documentary");
  expect(out).toContain("Style: Desk,Desk Editorial Sans,54");
  expect(out).toContain("540,1540");
  expect(subtitleAss(cues, "story")).toContain("Style: Desk,JetBrains Mono,40");
});

it("wraps the opening at its sentence boundary without changing the spoken words", () => {
  expect(
    captionChunks("Australia is building homes. Why is buying one getting harder?", 34)
  ).toEqual([["Australia is building homes.", "Why is buying one getting harder?"]]);
});
