import { describe, expect, it, vi } from "vitest";
vi.mock("../db/editorialCoverage", () => ({
  readCoverage: vi.fn(async () => ({ rows: [] })),
  saveCoverage: vi.fn(async () => ({ version: 1 })),
}));
import { readCoverage, saveCoverage } from "../db/editorialCoverage";
import { healthRouter } from "./health";
import type { TrpcContext } from "../core/context";
describe("coverage review authorization", () => {
  it.each([null, { id: 1, role: "user" }])(
    "blocks read and write before accessing storage",
    async (user) => {
      vi.clearAllMocks();
      const caller = healthRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
      await expect(caller.coverageReview({ day: "2026-09-10" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        caller.saveCoverageReview({ day: "2026-09-10", version: 0, entries: [] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(readCoverage).not.toHaveBeenCalled();
      expect(saveCoverage).not.toHaveBeenCalled();
    }
  );
  it("takes reviewer identity from the authenticated admin and validates input", async () => {
    vi.clearAllMocks();
    const caller = healthRouter.createCaller({
      user: { id: 7, role: "admin" },
      req: {},
      res: {},
    } as TrpcContext);
    await caller.saveCoverageReview({ day: "2026-09-10", version: 0, entries: [] });
    expect(saveCoverage).toHaveBeenCalledWith({ day: "2026-09-10", version: 0, entries: [] }, 7);
    await expect(caller.coverageReview({ day: "2026-02-31" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
