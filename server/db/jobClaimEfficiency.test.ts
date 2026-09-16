import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  read: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  demo: false,
  available: true,
}));
vi.mock("./client", () => ({
  getDb: () =>
    m.available
      ? {
          select: () => ({ from: () => ({ where: () => ({ limit: m.read }) }) }),
          insert: () => ({ values: m.insert }),
          update: () => ({ set: () => ({ where: m.update }) }),
          transaction: m.transaction,
        }
      : null,
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => m.demo }));
import { claimJobRun } from "./jobRuns";
import { claimCollectionRun } from "./collectionRuns";

beforeEach(() => {
  vi.resetAllMocks();
  m.demo = false;
  m.available = true;
  m.read.mockResolvedValue([]);
  m.insert.mockResolvedValue(undefined);
  m.update.mockResolvedValue([{ affectedRows: 0 }]);
  m.transaction.mockResolvedValue(null);
});

it.each([
  { status: "success", attempts: 1 },
  { status: "running", attempts: 1 },
  { status: "failed", attempts: 3 },
  { status: "unknown", attempts: 1 },
])("declines $status ordinary jobs with one read and no write", async (row) => {
  m.read.mockResolvedValue([row]);
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(0);
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});

it("does not write during repeated completed collector polls", async () => {
  m.read.mockResolvedValue([{ status: "success" }]);
  for (let i = 0; i < 60; i++)
    expect(await claimCollectionRun("daily-metrics", "2026-09-17")).toBeNull();
  expect(m.read).toHaveBeenCalledTimes(60);
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});

it.each([[], [{ status: "running" }], [{ status: "failed" }], [{ status: "pending" }]])(
  "retains locked collector arbitration for non-success state %#",
  async (...rows) => {
    m.read.mockResolvedValue(rows);
    await claimCollectionRun("daily-metrics", "2026-09-17");
    expect(m.transaction).toHaveBeenCalledTimes(1);
  }
);

it("requires a successful insert to grant a new ordinary claim", async () => {
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(1);
  expect(m.insert).toHaveBeenCalledTimes(1);
  expect(m.update).not.toHaveBeenCalled();
});

it("does not grant ownership when a competitor wins after the empty read", async () => {
  m.insert.mockRejectedValue(new Error("duplicate key"));
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(0);
  expect(m.update).toHaveBeenCalledTimes(1);
});

it("skips duplicate inserts on an eligible retry but still requires a conditional write", async () => {
  m.read
    .mockResolvedValueOnce([{ status: "failed", attempts: 1 }])
    .mockResolvedValueOnce([{ attempts: 2 }]);
  m.update.mockResolvedValue([{ affectedRows: 1 }]);
  expect(await claimJobRun("daily-feed", "2026-09-17")).toBe(2);
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledTimes(1);
  expect(m.read).toHaveBeenCalledTimes(2);
});

it("does not grant a retry when another worker changes the row after the read", async () => {
  m.read.mockResolvedValue([{ status: "failed", attempts: 1 }]);
  expect(await claimJobRun("daily-feed", "2026-09-17")).toBe(0);
  expect(m.update).toHaveBeenCalledTimes(1);
});

it("fails closed on unavailable reads, without attempting writes", async () => {
  m.read.mockRejectedValue(new Error("database unavailable"));
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(0);
  await expect(claimCollectionRun("daily-metrics", "2026-09-17")).rejects.toThrow(
    "database unavailable"
  );
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});

it("never makes a network read in demo or without a configured database", async () => {
  m.demo = true;
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(0);
  await expect(claimCollectionRun("daily-metrics", "2026-09-17")).rejects.toThrow();
  m.demo = false;
  m.available = false;
  expect(await claimJobRun("instagram-daily", "2026-09-17")).toBe(0);
  await expect(claimCollectionRun("daily-metrics", "2026-09-17")).rejects.toThrow();
  expect(m.read).not.toHaveBeenCalled();
});
