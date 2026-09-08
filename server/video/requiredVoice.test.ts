import { expect, it, vi } from "vitest";
vi.mock("./narration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./narration")>()),
  synthesiseScript: vi.fn().mockResolvedValue(null),
}));
import { renderStatReel } from "./statReel";
import { synthesiseScript } from "./narration";
it("stops a default render when speech generation fails", async () => {
  await expect(
    renderStatReel({
      label: "Rents",
      value: "0.7pp",
      line: "A verified gap.",
      subtext: "July 2026",
    })
  ).rejects.toThrow("No silent Reel");
});
it("preserves the actual narration error for the publishing status", async () => {
  vi.mocked(synthesiseScript).mockRejectedValueOnce(
    new Error("Local narration exceeded its 90-second limit.")
  );
  await expect(
    renderStatReel({
      label: "Rents",
      value: "0.7pp",
      line: "A verified gap.",
      subtext: "July 2026",
    })
  ).rejects.toThrow("90-second limit");
});

it("rejects an overlong story instead of silently reverting to a card read", async () => {
  const before = vi.mocked(synthesiseScript).mock.calls.length;
  await expect(
    renderStatReel(
      { label: "Rents", value: "0.7pp", line: "Verified", subtext: "July 2026" },
      "light",
      {
        script: [{ key: "label", text: "word ".repeat(150) }],
      }
    )
  ).rejects.toThrow("editorial limit");
  expect(vi.mocked(synthesiseScript).mock.calls.length).toBe(before);
});
