import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidate } from "../core/cache";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), fetch: vi.fn(), demo: vi.fn() }));
vi.mock("../db/planningSnapshots", () => ({
  readPlanningSnapshots: mocks.read,
  savePlanningSnapshot: mocks.save,
}));
vi.mock("./nswDa", () => ({ fetchNswPlanningSnapshot: mocks.fetch }));
vi.mock("../demo/store", () => ({ isDemoMode: mocks.demo }));
import { getNswPlanningPilot } from "./read";
beforeEach(() => {
  vi.resetAllMocks();
  invalidate("nsw:");
  mocks.demo.mockReturnValue(false);
  mocks.read.mockResolvedValue([]);
});
describe("planning publication and revision storage", () => {
  it("single-flights requests, persists the complete snapshot and exposes no individual records", async () => {
    const snapshot = { retrievedAt: new Date().toISOString(), applications: 161 };
    const records = [{ applicationId: "PAN-1" }];
    mocks.fetch.mockResolvedValue({ snapshot, records });
    const results = await Promise.all([getNswPlanningPilot(), getNswPlanningPilot()]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith(snapshot, records);
    expect(results[0]).toEqual({ status: "available", snapshot, previous: [] });
  });
  it("publishes nothing on source or storage failure", async () => {
    mocks.fetch.mockRejectedValue(new Error("source down"));
    expect((await getNswPlanningPilot()).status).toBe("unavailable");
    expect(mocks.save).not.toHaveBeenCalled();
    invalidate("nsw:");
    mocks.fetch.mockResolvedValue({ snapshot: {}, records: [] });
    mocks.save.mockRejectedValue(new Error("storage down"));
    expect((await getNswPlanningPilot()).status).toBe("unavailable");
  });
  it("reuses a recent durable snapshot after a restart without extra source traffic", async () => {
    const latest = { retrievedAt: new Date().toISOString() },
      older = { retrievedAt: "2026-01-01T00:00:00Z" };
    mocks.read.mockResolvedValue([latest, older]);
    expect(await getNswPlanningPilot()).toEqual({
      status: "available",
      snapshot: latest,
      previous: [older],
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("retains earlier checks when refreshing an expired snapshot", async () => {
    const earlier = { retrievedAt: "2026-01-01T00:00:00Z", applications: 1 };
    const snapshot = { retrievedAt: new Date().toISOString(), applications: 2 };
    mocks.read.mockResolvedValue([earlier]);
    mocks.fetch.mockResolvedValue({ snapshot, records: [] });
    expect(await getNswPlanningPilot()).toEqual({
      status: "available",
      snapshot,
      previous: [earlier],
    });
  });
});
