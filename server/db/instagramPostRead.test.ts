import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("./client", () => ({ getDb: m.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { listInstagramPosts } from "./instagramPosts";
beforeEach(() => vi.resetAllMocks());
it("reports unavailable admin records instead of claiming an empty post history", async () => {
  m.db.mockReturnValue(null);
  await expect(listInstagramPosts(100, true)).rejects.toThrow("unavailable");
  expect(await listInstagramPosts()).toEqual([]);
});
it("propagates query failure for reporting while preserving best-effort publishing callers", async () => {
  m.db.mockReturnValue({
    select: () => {
      throw new Error("DB disconnected");
    },
  });
  await expect(listInstagramPosts(100, true)).rejects.toThrow("could not be read");
  expect(await listInstagramPosts()).toEqual([]);
});
