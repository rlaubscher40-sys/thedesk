import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidate } from "../core/cache";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), fetch: vi.fn(), demo: vi.fn() }));
vi.mock("../db/planningSnapshots", () => ({
  readPlanningSnapshots: mocks.read,
  savePlanningSnapshot: mocks.save,
}));
vi.mock("./nswDa", () => ({ fetchNswPlanningSnapshot: mocks.fetch }));
vi.mock("../demo/store", () => ({ isDemoMode: mocks.demo }));
import { getNswPlanningPilot, getStoredPlanningPilot } from "./read";
beforeEach(() => {
  vi.resetAllMocks();
  invalidate("nsw:");
  mocks.demo.mockReturnValue(false);
  mocks.read.mockResolvedValue([]);
});
describe("planning publication and revision storage", () => {
  it("reads the exact stored historical month and fingerprint without source collection", async () => {
    const snapshot = {councilName:"Council of the City of Sydney", from:"2025-08-01",to:"2025-08-31",completePagination:true,fingerprint:"a".repeat(64),retrievedAt:"2025-09-01T00:00:00Z"};
    mocks.read.mockResolvedValue([snapshot]);
    expect(await getStoredPlanningPilot("2025-08", "a".repeat(64))).toEqual({status:"available",snapshot,previous:[]});
    expect(mocks.read).toHaveBeenCalledWith(snapshot.councilName,snapshot.from,snapshot.to,snapshot.fingerprint);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not substitute another revision or month for missing evidence", async () => {
    mocks.read.mockResolvedValue([{councilName:"Council of the City of Sydney",from:"2025-08-01",to:"2025-08-31",completePagination:true,fingerprint:"b".repeat(64)}]);
    expect((await getStoredPlanningPilot("2025-08","a".repeat(64))).status).toBe("unavailable");
    expect((await getStoredPlanningPilot("2025-07")).status).toBe("unavailable");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("fails closed on invalid dates, incomplete months, invalid hashes and storage failures", async () => {
    for (const period of ["", "2026-13", "2025-01-01", "2099-01"]) expect((await getStoredPlanningPilot(period)).status).toBe("unavailable");
    expect((await getStoredPlanningPilot("2025-08","x")).status).toBe("unavailable");
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockRejectedValue(new Error("DB unavailable"));
    expect((await getStoredPlanningPilot("2025-08")).status).toBe("unavailable");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
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
