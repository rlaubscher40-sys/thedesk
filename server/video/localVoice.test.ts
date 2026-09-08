import { describe, expect, it } from "vitest";
import { audibleWave } from "./localVoice";

function wav(silent = false) {
  const b = Buffer.alloc(44 + 22050 * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  if (!silent)
    for (let i = 44; i < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 10) * 2000), i);
  return b;
}
describe("audible PCM guard", () => {
  it("accepts bounded mono PCM with audible samples", () => expect(audibleWave(wav())).toBe(true));
  it("rejects silent output and text error bodies", () => {
    expect(audibleWave(wav(true))).toBe(false);
    expect(audibleWave(Buffer.from("error"))).toBe(false);
  });
  it("rejects truncated chunks, wrong encoding and implausible duration", () => {
    expect(audibleWave(wav().subarray(0, 100))).toBe(false);
    const b = wav();
    b.writeUInt16LE(3, 20);
    expect(audibleWave(b)).toBe(false);
    const c = wav();
    c.writeUInt32LE(1, 24);
    expect(audibleWave(c)).toBe(false);
  });
});
