import { describe, expect, it, vi } from "vitest";
vi.mock("./client", () => ({ getDb: vi.fn(() => null) }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { expireReelDelivery } from "./jobRuns";

describe("preparation lease expiry", () => {
  it("allows the bounded daily preparation key", async () => {
    await expect(
      expireReelDelivery("instagram-reel-delivery-programme-v1", "2026-09-09", new Date())
    ).resolves.toBeUndefined();
  });
  it("refuses publication and unrelated job keys before attempting a database write", async () => {
    for (const key of [
      "instagram-reel-abs-rents-brisbane-perth-v1",
      "instagram-daily",
      "instagram-reel-abs-approvals-brisbane-perth-v1",
      "instagram-launch-comparison",
      "instagram-reel-delivery-2026-07-02",
    ]) {
      await expect(expireReelDelivery(key, "2026-09-09", new Date())).rejects.toThrow(
        "Only Reel delivery"
      );
    }
  });
});
