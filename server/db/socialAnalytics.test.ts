import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ db: vi.fn(), group: vi.fn(), values: vi.fn(), select: vi.fn() }));
vi.mock("./client", () => ({ getDb: m.db }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { recordEngagementEvent, socialPerformance } from "./analytics";
beforeEach(() => {
  vi.clearAllMocks();
  m.db.mockReturnValue({ insert: () => ({ values: m.values }), select: m.select });
  m.select.mockReturnValue({ from: () => ({ where: () => ({ groupBy: m.group }) }) });
});
describe("social outcome persistence", () => {
  it("keeps fixed campaign labels on events without adding them to page-view counts", async () => {
    await recordEngagementEvent({
      event: "social_open",
      surface: "social",
      sessionId: "test-session",
      socialCampaign: "bio",
    });
    expect(m.values).toHaveBeenCalledWith({
      path: "@event/social_open/social",
      referrer: null,
      sessionId: "test-session",
      campaign: "ig:bio",
    });
  });
  it("distinguishes unavailable data from empty results", async () => {
    m.db.mockReturnValue(null);
    expect(await socialPerformance()).toEqual({ available: false, rows: [] });
    m.db.mockReturnValue({ select: m.select });
    m.group.mockResolvedValue([]);
    expect(await socialPerformance()).toEqual({ available: true, rows: [] });
    m.group.mockRejectedValue(new Error("offline"));
    expect(await socialPerformance()).toEqual({ available: false, rows: [] });
  });
  it("returns only the fixed cohorts and numeric session counts", async () => {
    m.group.mockResolvedValue([
      { campaign: "ig:bio", landings: "2", onward: "1", sources: "0", shares: "0" },
      { campaign: "ig:arbitrary-private-query", landings: 1 },
    ]);
    expect(await socialPerformance()).toEqual({
      available: true,
      rows: [{ campaign: "bio", landings: 2, onward: 1, sources: 0, shares: 0 }],
    });
  });
});
