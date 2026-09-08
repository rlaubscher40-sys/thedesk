import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
}));
vi.mock("./client", () => ({ getDb: m.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { reserveSocialRecords } from "./socialPublication";
beforeEach(() => {
  vi.resetAllMocks();
  m.insert.mockReturnValue({ values: m.values });
  m.transaction.mockImplementation(async (fn: (db: unknown) => unknown) =>
    fn({ insert: m.insert })
  );
  m.db.mockReturnValue({ transaction: m.transaction });
});
it("reserves the slot and story identities in one transaction and one insert", async () => {
  const a = "ig-news-" + "a".repeat(56),
    b = "ig-slot-" + "b".repeat(56);
  await reserveSocialRecords([b, a, a]);
  expect(m.transaction).toHaveBeenCalledOnce();
  expect(m.values).toHaveBeenCalledOnce();
  expect(m.values.mock.calls[0]![0]).toMatchObject([
    { jobKey: a, runDate: "1970-01-01", status: "running", attempts: 1 },
    { jobKey: b, runDate: "1970-01-01", status: "running", attempts: 1 },
  ]);
});
it("propagates duplicate insert/transaction errors instead of allowing a partial claim", async () => {
  m.values.mockRejectedValue(new Error("Duplicate key"));
  await expect(reserveSocialRecords(["ig-news-" + "a".repeat(56)])).rejects.toThrow(
    "Duplicate key"
  );
});
it("fails closed without a durable database", async () => {
  m.db.mockReturnValue(null);
  await expect(reserveSocialRecords(["ig-news-" + "a".repeat(56)])).rejects.toThrow("unavailable");
});
