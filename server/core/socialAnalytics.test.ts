import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Express, Request, Response } from "express";
const m = vi.hoisted(() => ({ page: vi.fn(), event: vi.fn() }));
vi.mock("../db", () => ({ recordPageView: m.page, recordEngagementEvent: m.event }));
import { registerAnalyticsRoutes } from "./analyticsRoutes";
const routes = new Map<string, (req: Request, res: Response) => Promise<void>>();
registerAnalyticsRoutes({
  post: (path: string, ...handlers: unknown[]) => routes.set(path, handlers.at(-1) as never),
} as Express);
async function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() };
  await routes.get(path)!(
    {
      body,
      header: (key: string) =>
        headers[key] ??
        (key === "user-agent" ? "Mozilla/5.0" : key === "host" ? "thedesk.au" : undefined),
    } as Request,
    res as unknown as Response
  );
  return res;
}
beforeEach(() => vi.clearAllMocks());
describe("bounded Instagram website measurements", () => {
  it("records a first landing separately from page views, with a fixed topic", async () => {
    await request("/api/analytics/pageview", {
      path: "/markets/sydney?private=data",
      sessionId: "fixture-session",
      campaign: "instagram",
      socialCampaign: "rent_change",
      isLanding: true,
    });
    expect(m.page).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/markets/:market", campaign: "instagram" })
    );
    expect(m.event).toHaveBeenCalledWith({
      event: "social_landing",
      socialCampaign: "rent_change",
      sessionId: "fixture-session",
    });
  });
  it("does not count ordinary navigation as another landing", async () => {
    await request("/api/analytics/pageview", {
      path: "/",
      sessionId: "fixture-session",
      campaign: "instagram",
      socialCampaign: "bio",
      isLanding: false,
    });
    expect(m.event).not.toHaveBeenCalled();
  });
  it("validates cohorts and actions server-side and respects DNT", async () => {
    const body = {
      event: "social_open",
      surface: "social",
      sessionId: "fixture-session",
      socialCampaign: "bio",
    };
    await request("/api/analytics/event", body);
    expect(m.event).toHaveBeenCalledWith(body);
    m.event.mockClear();
    expect(
      (await request("/api/analytics/event", { ...body, socialCampaign: "secret@example.com" }))
        .status
    ).toHaveBeenCalledWith(400);
    await request("/api/analytics/event", body, { dnt: "1" });
    expect(m.event).not.toHaveBeenCalled();
  });
});
