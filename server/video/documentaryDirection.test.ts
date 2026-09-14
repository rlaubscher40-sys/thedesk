import { describe, expect, it } from "vitest";
import { DOCUMENTARY_DIRECTION, documentaryEdit } from "./documentaryDirection";
import { documentarySoundtrack } from "./documentarySoundtrack";

const scenes = Array.from({ length: 8 }, (_, i) => ({
  start: i * 2,
  seconds: 2,
  phrases: [
    { text: "First phrase.", start: 0, seconds: 0.9 },
    { text: "Second phrase.", start: 1, seconds: 1 },
  ],
}));

describe("authored documentary direction", () => {
  it("enters every new visual at its boundary and holds the final visual through the tail", () => {
    for (const [shot, cuts] of DOCUMENTARY_DIRECTION.cuts.entries()) {
      expect(cuts[0]).toBe(0);
      for (const [index, cut] of cuts.entries()) {
        expect(documentaryEdit(shot, cut)).toMatchObject({ index, progress: 0 });
        if (index) expect(documentaryEdit(shot, cut - 0.0001).index).toBe(index - 1);
      }
      expect(documentaryEdit(shot, 1)).toMatchObject({ index: cuts.length - 1, progress: 1 });
    }
    expect(() => documentaryEdit(16, 0)).toThrow();
    expect(() => documentaryEdit(0, NaN)).toThrow();
  });

  it("produces audible stereo PCM with an exact duration, bounded peaks and a silent tail", () => {
    const wave = documentarySoundtrack(scenes, 16);
    expect(wave.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wave.readUInt16LE(22)).toBe(2);
    expect(wave.readUInt32LE(24)).toBe(48000);
    expect(wave.readUInt32LE(40)).toBe(16 * 48000 * 4);
    expect(wave.length).toBe(44 + 16 * 48000 * 4);
    let peak = 0,
      channelDifference = false;
    for (let i = 44; i < wave.length; i += 4) {
      const left = wave.readInt16LE(i),
        right = wave.readInt16LE(i + 2);
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      channelDifference ||= left !== right;
    }
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThanOrEqual(Math.ceil(0.11 * 32767));
    expect(channelDifference).toBe(true);
    expect(Math.abs(wave.readInt16LE(wave.length - 2))).toBeLessThan(2);
    expect(documentarySoundtrack(scenes, 16).equals(wave)).toBe(true);
  });

  it("rejects invalid timing before allocating or mixing a score", () => {
    for (const total of [NaN, 0, 181]) expect(() => documentarySoundtrack(scenes, total)).toThrow();
    const bad = structuredClone(scenes);
    bad[3]!.phrases[1]!.seconds = 3;
    expect(() => documentarySoundtrack(bad, 16)).toThrow("timeline");
    bad[3]!.phrases.pop();
    expect(() => documentarySoundtrack(bad, 16)).toThrow("timeline");
  });
});
