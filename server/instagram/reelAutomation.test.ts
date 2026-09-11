import { testLoanRates, testMigration } from "./fixtures/contextReels";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  env: {
    enableScheduler: true,
    scheduledApiKey: "test",
    instagramAccessToken: "test",
    instagramBusinessAccountId: "test",
  },
  data: vi.fn(),
  approvals: vi.fn(),
  housing: vi.fn(),
  demographics: vi.fn(),
  lending: vi.fn(),
  read: vi.fn(),
  claim: vi.fn(),
  mark: vi.fn(),
  post: vi.fn(),
  alert: vi.fn(),
  expire: vi.fn(),
}));
vi.mock("../markets/absDemographics", () => ({ getStateDemographics: m.demographics }));
vi.mock("../markets/reelLendingRates", () => ({ getReelLendingRates: m.lending }));
vi.mock("../core/env", () => ({ env: m.env }));
vi.mock("../markets/absRents", () => ({ getCityRents: m.data }));
vi.mock("../markets/absApprovals", () => ({ getCityApprovals: m.approvals }));
vi.mock("../markets/housingBalance", () => ({ getHousingBalanceSnapshot: m.housing }));
vi.mock("../db/jobRuns", () => ({
  readJobRun: m.read,
  claimJobRun: m.claim,
  markJobRun: m.mark,
  expireReelDelivery: m.expire,
}));
import { readReelAutomation, runReelAutomation } from "./reelAutomation";
import { reelPublicationRecord } from "./reelStatus";
import { RENT_CITIES } from "../../shared/cityRents";
import { verifiedCapitalRentReel } from "./verifiedCapitalRentReel";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
const now = new Date("2026-09-09T08:30:00Z"); // Wednesday 6:30pm Sydney.
const publicationKey = "instagram-reel-abs-rents-brisbane-perth-v1";
let published = false;
beforeEach(() => {
  vi.resetAllMocks();
  published = false;
  m.housing.mockResolvedValue(null);
  m.demographics.mockResolvedValue({ status: "unavailable", retrievedAt: null, observations: [] });
  m.lending.mockResolvedValue([]);
  m.approvals.mockResolvedValue({ status: "unavailable", observations: [] });
  m.env.enableScheduler = true;
  m.env.instagramAccessToken = "test";
  m.data.mockResolvedValue({
    status: "available",
    retrievedAt: now.toISOString(),
    observations: [
      { city: "Brisbane", annualPercent: 4.6, period: "2026-07", status: "" },
      { city: "Perth", annualPercent: 5.3, period: "2026-07", status: "" },
    ],
  });
  m.read.mockImplementation(async (key: string) =>
    key === publicationKey && published
      ? { status: "success", detail: "Published media 123456" }
      : null
  );
  m.claim.mockResolvedValue(1);
  m.post.mockImplementation(async () => {
    published = true;
    return { success: true, postId: "123456" };
  });
  m.alert.mockResolvedValue(undefined);
});
const run = () => runReelAutomation({ post: m.post, alert: m.alert, now });

describe("automatic verified Reel delivery", () => {
  it("advances to the eight-capital topic without clearing earlier publication locks", async () => {
    const data = {
      status: "available" as const,
      retrievedAt: now.toISOString(),
      observations: RENT_CITIES.map((city, i) => ({
        city,
        annualPercent: i,
        period: "2026-07",
        status: "" as const,
      })),
    };
    m.data.mockResolvedValue(data);
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? {
            status: "success",
            detail: "Published media 123456",
            finishedAt: new Date("2026-09-07T10:00:00Z"),
          }
        : null
    );
    const plan = await readReelAutomation(now);
    expect(plan.state).toBe("ready");
    expect(plan.candidate?.evidenceHash).toBe(verifiedCapitalRentReel(data, now)?.evidenceHash);
    expect(plan.candidate?.publication.key).toBe("instagram-reel-abs-rents-eight-capitals-v1");
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? { status: "success", detail: "Published media 123456", finishedAt: now }
        : null
    );
    expect((await readReelAutomation(now)).state).toBe("daily-limit");
    expect(m.post).not.toHaveBeenCalled();
  });
  it("delivers outside old weekday windows and ignores old daily skip watermarks", async () => {
    m.read.mockImplementation(async (key: string) =>
      key === "instagram-reel"
        ? { status: "success" }
        : key === publicationKey && published
          ? { status: "success", detail: "Published media 123456" }
          : null
    );
    expect(await run()).toEqual({ state: "published", postId: "123456" });
    expect(m.claim).toHaveBeenCalledWith("instagram-reel-delivery-programme-v1", "2026-09-09", 2);
    expect(m.post).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(m.mark).toHaveBeenCalledWith(
      expect.any(String),
      "2026-09-09",
      "success",
      "Published media 123456"
    );
  });
  it("does not repeat a confirmed reference month on the next poll/restart", async () => {
    await run();
    expect(await run()).toEqual({ state: "published" });
    expect(m.post).toHaveBeenCalledTimes(1);
  });
  it("does not call Meta when disabled or account credentials are absent", async () => {
    m.env.enableScheduler = false;
    expect(await run()).toEqual({ state: "disabled" });
    m.env.enableScheduler = true;
    m.env.instagramAccessToken = "";
    expect(await run()).toEqual({ state: "disabled" });
    expect(m.data).not.toHaveBeenCalled();
    expect(m.post).not.toHaveBeenCalled();
  });
  it("waits for evidence without consuming a delivery attempt", async () => {
    m.data.mockResolvedValue({ status: "unavailable", observations: [] });
    expect(await run()).toEqual({ state: "no-evidence" });
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("fails closed if publication or delivery records cannot be read", async () => {
    m.read.mockRejectedValue(new Error("DB unavailable"));
    expect(await run()).toEqual({ state: "unavailable" });
    m.read.mockImplementation(async (key: string) => {
      if (key !== publicationKey) throw new Error("DB unavailable");
      return null;
    });
    expect(await run()).toEqual({ state: "unavailable" });
    expect(m.post).not.toHaveBeenCalled();
  });
  it("respects an uncertain or interrupted publication permanently", async () => {
    for (const status of ["failed", "running", "success"]) {
      m.read.mockResolvedValue({ status, detail: "Outcome unknown" });
      expect(await run()).toEqual({ state: "locked" });
    }
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("allows only the atomic delivery claimant to render", async () => {
    m.claim.mockResolvedValue(0);
    expect(await run()).toEqual({ state: "busy" });
    expect(m.post).not.toHaveBeenCalled();
  });
  it("never calls a skipped HTTP 200 a publication", async () => {
    m.post.mockResolvedValue({ success: true, skipped: true, reason: "Evidence changed" });
    expect(await run()).toEqual({ state: "retrying" });
    expect(m.mark).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "failed",
      "Evidence changed"
    );
    expect(m.mark).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "success",
      expect.anything()
    );
  });
  it("waits 15 minutes before a safe second attempt and caps attempts per day", async () => {
    const row = {
      status: "failed",
      attempts: 1,
      detail: "Render failed",
      finishedAt: new Date(now.getTime() - 5 * 60_000),
    };
    m.read.mockImplementation(async (key: string) => (key === publicationKey ? null : row));
    expect(await run()).toEqual({ state: "retrying" });
    expect(m.claim).not.toHaveBeenCalled();
    row.finishedAt = new Date(now.getTime() - 15 * 60_000);
    expect((await readReelAutomation(now)).state).toBe("ready");
    row.attempts = 2;
    expect(await run()).toEqual({ state: "paused" });
  });
  it("does not reclaim a running delivery after restart", async () => {
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey ? null : { status: "running", startedAt: now, attempts: 1 }
    );
    expect(await run()).toEqual({ state: "running" });
    expect(m.post).not.toHaveBeenCalled();
  });
  it("recovers expired preparation while preserving the separate publication lock", async () => {
    const stale = {
      status: "running",
      startedAt: new Date(now.getTime() - 16 * 60_000),
      attempts: 1,
    };
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? published
          ? { status: "success", detail: "Published media 123456" }
          : null
        : stale
    );
    expect(await run()).toEqual({ state: "published", postId: "123456" });
    expect(m.expire).toHaveBeenCalledWith(
      "instagram-reel-delivery-programme-v1",
      "2026-09-09",
      expect.any(Date)
    );
    m.expire.mockClear();
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey ? { status: "running" } : stale
    );
    expect(await run()).toEqual({ state: "locked" });
    expect(m.expire).not.toHaveBeenCalled();
  });
  it("does not retry a rate block or exhaust preparation retries forever after restart", async () => {
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? null
        : { status: "failed", attempts: 1, detail: "PAUSED: rate limit" }
    );
    expect(await run()).toEqual({ state: "paused" });
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? null
        : { status: "running", attempts: 2, startedAt: new Date(now.getTime() - 16 * 60_000) }
    );
    expect(await run()).toEqual({ state: "paused" });
    expect(m.expire).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("alerts once when retries are exhausted; a rate block pauses immediately", async () => {
    m.claim.mockResolvedValue(2);
    m.post.mockRejectedValue(new Error("Render failed"));
    expect(await run()).toEqual({ state: "blocked" });
    expect(m.alert).toHaveBeenCalledWith("Render failed", 2);
    m.claim.mockResolvedValue(1);
    m.post.mockRejectedValue(new Error("Instagram API 429 rate limit"));
    expect(await run()).toEqual({ state: "blocked" });
    expect(m.mark).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      "failed",
      expect.stringContaining("PAUSED:")
    );
  });
  it("a lost delivery response is recovered only from the exact publication record", async () => {
    m.post.mockImplementation(async () => {
      published = true;
      throw new Error("connection closed");
    });
    expect(await run()).toEqual({ state: "published", postId: "123456" });
    expect(m.post).toHaveBeenCalledTimes(1);
    expect(m.alert).not.toHaveBeenCalled();
  });
  it("exposes confirmed publication separately from locked or unavailable", async () => {
    const key = { key: publicationKey, date: "2026-07-01" };
    expect((await reelPublicationRecord(key)).state).toBe("available");
    published = true;
    expect(await reelPublicationRecord(key)).toMatchObject({
      state: "published",
      postId: "123456",
    });
  });
});

describe("multiple verified topics", () => {
  const housingNow = new Date("2026-09-10T08:30:00Z");
  const housingKey = "instagram-reel-nhsac-housing-balance-v1";
  it("advances to verified housing evidence without repeating confirmed rents", async () => {
    m.housing.mockResolvedValue(structuredClone(HOUSING_BALANCE_SNAPSHOT));
    published = true;
    const plan = await readReelAutomation(housingNow);
    expect(plan.state).toBe("ready");
    expect(plan.candidate?.publication.key).toBe(housingKey);
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? { status: "success", detail: "Published media 123456", finishedAt: housingNow }
        : null
    );
    expect(await runReelAutomation({ post: m.post, alert: m.alert, now: housingNow })).toEqual({
      state: "daily-limit",
    });
    expect(m.post).not.toHaveBeenCalled();
  });
  it("preserves an uncertain housing publication even when newer rents are available", async () => {
    m.housing.mockResolvedValue(structuredClone(HOUSING_BALANCE_SNAPSHOT));
    m.read.mockImplementation(async (key: string) =>
      key === housingKey ? { status: "running", detail: "Outcome unknown" } : null
    );
    expect(await runReelAutomation({ post: m.post, alert: m.alert, now: housingNow })).toEqual({
      state: "locked",
    });
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.post).not.toHaveBeenCalled();
  });
  const supplyKey = "instagram-reel-abs-approvals-brisbane-perth-v1";
  function approvals() {
    m.approvals.mockResolvedValue({
      status: "available",
      observations: ["Brisbane", "Perth"].flatMap((city) =>
        Array.from({ length: 12 }, (_, i) => ({
          city,
          period: new Date(Date.UTC(2026, 6 - i, 1)).toISOString().slice(0, 7),
          dwellings: 1000,
          status: "",
        }))
      ),
    });
  }
  it("moves to approvals after the rent topic is confirmed", async () => {
    approvals();
    published = true;
    const plan = await readReelAutomation(now);
    expect(plan.state).toBe("ready");
    expect(plan.candidate?.publication.key).toBe(supplyKey);
  });
  it("does not publish another topic after the shared daily slot is used", async () => {
    approvals();
    published = true;
    m.read.mockImplementation(async (key: string) =>
      key === publicationKey
        ? { status: "success", detail: "Published media 123456" }
        : key === supplyKey
          ? null
          : { status: "success", detail: "Published media 123456" }
    );
    expect(await run()).toEqual({ state: "daily-limit" });
    expect(m.post).not.toHaveBeenCalled();
  });
  it("allows the second topic on a new Sydney day without reusing the rent publication", async () => {
    approvals();
    published = true;
    m.read.mockImplementation(async (key: string, date: string) =>
      key === publicationKey
        ? { status: "success", detail: "Published media 123456" }
        : key === supplyKey
          ? null
          : date === "2026-09-09"
            ? { status: "success", detail: "Published media 123456" }
            : null
    );
    expect((await readReelAutomation(now)).state).toBe("daily-limit");
    const plan = await readReelAutomation(new Date("2026-09-10T08:30:00Z"));
    expect(plan.state).toBe("ready");
    expect(plan.candidate?.publication.key).toBe(supplyKey);
  });
  it("does not step around an uncertain publication to post the next topic", async () => {
    approvals();
    m.read.mockResolvedValue({ status: "running", detail: "Outcome unknown" });
    expect(await run()).toEqual({ state: "locked" });
    expect(m.post).not.toHaveBeenCalled();
  });
});

it("recovers the daily cap from confirmed publication when the delivery watermark was lost", async () => {
  m.approvals.mockResolvedValue({
    status: "available",
    observations: ["Brisbane", "Perth"].flatMap((city) =>
      Array.from({ length: 12 }, (_, i) => ({
        city,
        period: new Date(Date.UTC(2026, 6 - i, 1)).toISOString().slice(0, 7),
        dwellings: 1000,
        status: "",
      }))
    ),
  });
  m.read.mockImplementation(async (key: string) =>
    key === publicationKey
      ? { status: "success", detail: "Published media 123456", finishedAt: now }
      : null
  );
  expect(await run()).toEqual({ state: "daily-limit" });
  expect(m.claim).not.toHaveBeenCalled();
});

it("waits until the Sydney evening window without consuming a delivery attempt", async () => {
  expect((await readReelAutomation(new Date("2026-09-09T12:00:00Z"))).state).toBe("scheduled");
  expect((await readReelAutomation(new Date("2026-09-09T08:29:00Z"))).state).toBe("scheduled");
  expect((await readReelAutomation(new Date("2026-09-09T08:30:00Z"))).state).toBe("ready");
  expect(m.claim).not.toHaveBeenCalled();
});

describe("new family permanent publication records", () => {
  it("moves from published borrowing to population without reopening either period", async () => {
    m.data.mockResolvedValue({ status: "unavailable", retrievedAt: null, observations: [] });
    m.lending.mockResolvedValue(testLoanRates());
    m.demographics.mockResolvedValue(testMigration());
    const date = new Date("2026-09-11T08:30:00Z");
    const loans = "instagram-reel-rba-new-loan-rates-v1";
    const migration = "instagram-reel-abs-interstate-qld-wa-v1";
    expect((await readReelAutomation(date)).candidate?.publication.key).toBe(loans);
    m.read.mockImplementation(async (key: string) =>
      key === loans
        ? {
            status: "success",
            detail: "Published media 234567",
            finishedAt: new Date("2026-09-10T08:45:00Z"),
          }
        : null
    );
    expect((await readReelAutomation(date)).candidate?.publication.key).toBe(migration);
    m.read.mockResolvedValue({
      status: "success",
      detail: "Published media 234567",
      finishedAt: new Date("2026-09-10T08:45:00Z"),
    });
    expect((await readReelAutomation(date)).state).toBe("published");
    expect(m.post).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
  });
});
