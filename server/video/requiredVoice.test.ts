import { expect, it, vi } from "vitest";
vi.mock("./narration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./narration")>()),
  synthesiseScript: vi.fn().mockResolvedValue(null),
}));
import { renderStatReel } from "./statReel";
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
