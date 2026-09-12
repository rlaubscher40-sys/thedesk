import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ read: vi.fn(), reserve: vi.fn(), confirm: vi.fn() }));
vi.mock("../db/socialPublication", () => ({
  readSocialRecords: m.read,
  reserveSocialRecords: m.reserve,
  confirmSocialRecords: m.confirm,
}));
import { carouselStoryKey, publishCarouselStoryOnce } from "./carouselStoryReceipt";
beforeEach(() => {
  vi.resetAllMocks();
  m.read.mockResolvedValue([]);
});
it("requires an exact durable receipt before reporting success", async () => {
  const publish = vi.fn().mockResolvedValue("456");
  m.read
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        status: "success",
        detail: JSON.stringify({ carouselId: "123", sourceId: 42, storyId: "456" }),
      },
    ]);
  expect(await publishCarouselStoryOnce("123", 42, publish)).toBe("456");
  expect(m.reserve).toHaveBeenCalledWith([carouselStoryKey("123", 42)]);
  expect(m.reserve.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]!);
  expect(carouselStoryKey("123", 42)).not.toBe(carouselStoryKey("124", 42));
});
it.each(["running", "success", "failed"])(
  "never republishes an existing %s reservation",
  async (status) => {
    m.read.mockResolvedValue([{ status }]);
    const publish = vi.fn();
    await expect(publishCarouselStoryOnce("123", 42, publish)).rejects.toThrow("already reserved");
    expect(publish).not.toHaveBeenCalled();
  }
);
it("keeps unknown Meta outcomes locked without confirmation or retry", async () => {
  const publish = vi.fn().mockRejectedValue(new Error("response lost"));
  await expect(publishCarouselStoryOnce("123", 42, publish)).rejects.toThrow("response lost");
  expect(publish).toHaveBeenCalledOnce();
  expect(m.confirm).not.toHaveBeenCalled();
});
it("does not claim receipt success when persistence silently failed", async () => {
  await expect(publishCarouselStoryOnce("123", 42, async () => "456")).rejects.toThrow(
    "receipt not confirmed"
  );
});
it("does not enter Meta when the durable store cannot be read", async () => {
  m.read.mockRejectedValue(new Error("database down"));
  const publish = vi.fn();
  await expect(publishCarouselStoryOnce("123", 42, publish)).rejects.toThrow("database down");
  expect(publish).not.toHaveBeenCalled();
});
