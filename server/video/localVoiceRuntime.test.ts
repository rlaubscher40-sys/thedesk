import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  exec: vi.fn(),
  read: vi.fn(),
  rm: vi.fn(),
  callbacks: [] as Array<(error: unknown, out: string, stderr: string) => void>,
}));
vi.mock("node:child_process", () => ({ execFile: m.exec }));
vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn().mockResolvedValue("/tmp/voice-fixture"),
    readFile: m.read,
    rm: m.rm,
  },
}));
import { localSpeech, speechProcessFailure } from "./localVoice";
function wav() {
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
  for (let i = 44; i < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 10) * 2000), i);
  return b;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.callbacks.length = 0;
  m.read.mockResolvedValue(wav());
  m.rm.mockResolvedValue(undefined);
  m.exec.mockImplementation((_file, _args, _opts, callback) => {
    m.callbacks.push(callback);
    return { stdin: { on: vi.fn(), end: vi.fn() } };
  });
});
it("shares simultaneous exact scripts and reuses only their verified completed audio", async () => {
  const lines = [{ key: "value", text: "0.7 percentage points." }];
  const requests = Array.from({ length: 4 }, () => localSpeech(lines.map((l) => ({ ...l }))));
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(1));
  m.callbacks[0]!(null, "", "");
  const result = await Promise.all(requests);
  expect(result.every((audio) => audio === result[0])).toBe(true);
  expect(await localSpeech(lines)).toBe(result[0]);
  expect(m.exec).toHaveBeenCalledTimes(1);
});
it("serializes different scripts, bounds the queue and never reuses changed numbers", async () => {
  const first = localSpeech([{ key: "value", text: "4.6 percent." }]);
  const second = localSpeech([{ key: "value", text: "5.3 percent." }]);
  await expect(localSpeech([{ key: "check", text: "A third different request." }])).rejects.toThrow(
    "busy"
  );
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(1));
  m.callbacks[0]!(null, "", "");
  await first;
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(2));
  m.callbacks[1]!(null, "", "");
  await second;
});
it("preserves a process failure, cleans temporary audio and allows a later retry", async () => {
  const lines = [{ key: "value", text: "Retry fixture." }];
  const failed = expect(localSpeech(lines)).rejects.toThrow("SIGKILL");
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(1));
  m.callbacks[0]!({ signal: "SIGKILL", killed: false }, "", "test process killed");
  await failed;
  expect(m.rm).toHaveBeenCalled();
  const retry = localSpeech(lines);
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(2));
  m.callbacks[1]!(null, "", "");
  await retry;
});
it("distinguishes timeout, missing executable, permissions and exit errors", () => {
  expect(speechProcessFailure({ killed: true })).toContain("90-second");
  expect(speechProcessFailure({ code: "ENOENT" })).toContain("missing");
  expect(speechProcessFailure({ code: "EACCES" })).toContain("not permitted");
  expect(speechProcessFailure({ code: 1 })).toContain("code 1");
});

it("isolates voice auditions in the cache and rejects invalid profiles", async () => {
  const lines = [{ key: "audition", text: "A new voice should get its own audio." }];
  const george = localSpeech(lines, { voice: "bm_george", speed: 1 });
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(1));
  m.callbacks[0]!(null, "", "");
  await george;
  const fable = localSpeech(lines, { voice: "bm_fable", speed: 1 });
  await vi.waitFor(() => expect(m.exec).toHaveBeenCalledTimes(2));
  m.callbacks[1]!(null, "", "");
  await fable;
  await localSpeech(lines, { voice: "bm_george", speed: 1 });
  expect(m.exec).toHaveBeenCalledTimes(2);
  await expect(localSpeech(lines, { voice: "bm_fable", speed: NaN })).rejects.toThrow("profile");
  await expect(localSpeech(lines, { voice: "unknown" as never, speed: 1 })).rejects.toThrow(
    "profile"
  );
});
