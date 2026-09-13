import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  create: vi.fn(),
  ready: vi.fn(),
  publish: vi.fn(),
  receipt: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
  health: vi.fn(),
}));
vi.mock("./api", () => ({
  createStoryContainer: m.create,
  waitForContainerReady: m.ready,
  publishContainer: m.publish,
}));
vi.mock("./carouselStoryReceipt", () => ({ publishCarouselStoryOnce: m.receipt }));
vi.mock("./tempStore", () => ({ storeTempImage: m.store, removeTempImage: m.remove }));
vi.mock("../db/health", () => ({ recordServerError: m.health }));
import { postWeeklyStoryFrames } from "./weeklyStoryDelivery";
const opts = {
  frames: [Buffer.from("cover"), Buffer.from("detail"), Buffer.from("roundup")] as [
    Buffer,
    Buffer,
    Buffer,
  ],
  carouselId: "123",
  sourceId: 42,
  igUserId: "1",
  accessToken: "fixture",
  siteUrl: "https://thedesk.au",
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  m.store.mockReturnValue("image");
  m.create.mockResolvedValue("456");
  m.publish.mockResolvedValue("789");
  m.health.mockResolvedValue(undefined);
  m.receipt.mockImplementation(async (_id, _source, publish) => publish());
});
afterEach(() => vi.useRealTimers());
it("delivers three different frames in order, spaced after the confirmed carousel", async () => {
  const delivery = postWeeklyStoryFrames(opts);
  expect(m.create).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(44999);
  expect(m.create).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(m.publish).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(90000);
  await delivery;
  expect(m.store.mock.calls.map(([bytes]) => bytes.toString())).toEqual([
    "cover",
    "detail",
    "roundup",
  ]);
  expect(m.receipt.mock.calls.map((args) => args[3])).toEqual([
    "weekly-cover",
    "weekly-detail",
    "weekly-roundup",
  ]);
  expect(m.remove).toHaveBeenCalledTimes(3);
});
it.each(["Application request limit reached", "Response lost", "receipt not confirmed"])(
  "stops the sequence after %s and cleans its temporary media",
  async (message) => {
    m.receipt.mockRejectedValueOnce(new Error(message));
    const delivery = postWeeklyStoryFrames(opts);
    await vi.runAllTimersAsync();
    await delivery;
    expect(m.receipt).toHaveBeenCalledOnce();
    expect(m.remove).toHaveBeenCalledOnce();
    expect(m.health).toHaveBeenCalledOnce();
  }
);
