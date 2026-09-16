import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
const m = vi.hoisted(() => ({ getDb: vi.fn(), demo: false }));
vi.mock("../db/client", () => ({ getDb: m.getDb }));
vi.mock("../demo/store", async (original) => ({
  ...(await original<typeof import("../demo/store")>()),
  isDemoMode: () => m.demo,
}));
vi.mock("../db", () => import("../db/health"));
import * as health from "../db/health";
import { registerHealthRoutes } from "./healthRoutes";
type Handler = (req: Request, res: Response) => Promise<void>;
const routes = new Map<string, Handler>();
registerHealthRoutes({
  get: (path: string, ...handlers: Handler[]) => routes.set(path, handlers.at(-1)!),
  post: (path: string, ...handlers: Handler[]) => routes.set(path, handlers.at(-1)!),
} as unknown as Express);
function response() {
  return {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  };
}
async function request(path: string, key = "test-key") {
  const res = response();
  await routes.get(path)!(
    {
      header: () => key,
      body: { statusCode: 200, latencyMs: 12, source: "test" },
    } as unknown as Request,
    res as unknown as Response
  );
  return res;
}
beforeEach(() => {
  m.demo = false;
  m.getDb.mockReset().mockReturnValue(null);
  vi.stubEnv("SCHEDULED_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());

it("returns an uncached 503 when the database client is unavailable", async () => {
  const res = await request("/api/healthz");
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "degraded", db: false }));
});
it("returns 503 when the database read fails without exposing the database error", async () => {
  m.getDb.mockReturnValue({
    select: () => {
      throw new Error("private database detail");
    },
  });
  const res = await request("/api/healthz");
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private database detail");
});
it("accepts a successful database read with no historical pings", async () => {
  const limit = vi.fn().mockResolvedValue([]);
  m.getDb.mockReturnValue({ select: () => ({ from: () => ({ orderBy: () => ({ limit }) }) }) });
  const res = await request("/api/healthz");
  expect(limit).toHaveBeenCalledWith(1);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "ok", db: true }));
});
it("does not acknowledge a monitoring write when storage is missing or the insert fails", async () => {
  for (const database of [
    null,
    {
      insert: () => ({
        values: async () => {
          throw new Error("private write detail");
        },
      }),
    },
  ]) {
    m.getDb.mockReturnValue(database);
    const res = await request("/api/uptime/record");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "Monitoring storage unavailable" });
    expect(res.json).not.toHaveBeenCalledWith({ ok: true });
  }
});
it("acknowledges a stored check only after its insert resolves", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const values = vi.fn().mockReturnValue(pending);
  m.getDb.mockReturnValue({ insert: () => ({ values }) });
  const res = response();
  const run = routes.get("/api/uptime/record")!(
    {
      header: () => "test-key",
      body: { statusCode: 503, latencyMs: 12, source: "test" },
    } as unknown as Request,
    res as unknown as Response
  );
  expect(res.json).not.toHaveBeenCalled();
  finish();
  await run;
  expect(values).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503, source: "test" }));
  expect(res.json).toHaveBeenCalledWith({ ok: true });
});
it("rejects invalid keys, including unequal UTF-8 byte lengths, before storage access", async () => {
  for (const key of ["wrongkey", "éest-key", ""]) {
    const res = await request("/api/uptime/record", key);
    expect(res.status).toHaveBeenCalledWith(401);
  }
  expect(m.getDb).not.toHaveBeenCalled();
});
it("keeps missing health history, counts and clear actions unavailable instead of fabricating zero or success", async () => {
  const calls = [
    () => health.listRecentServerErrors(),
    () => health.countServerErrorsSince(new Date()),
    () => health.clearServerErrors(),
    () => health.listRecentUptimePings(),
    () => health.uptimeWindowStats(),
    () => health.uptimeMonitoringCoverage(),
  ];
  for (const call of calls) await expect(call()).rejects.toThrow(/unavailable/i);
  // Error logging remains best effort so logging a fault cannot create a fault loop.
  await expect(health.recordServerError({ message: "original error" })).resolves.toBeUndefined();
});
it("retains the explicit local demo flow without requiring a real database", async () => {
  m.demo = true;
  const res = await request("/api/healthz");
  expect(res.status).toHaveBeenCalledWith(200);
  await expect(health.listRecentServerErrors()).resolves.toEqual([]);
  expect(m.getDb).not.toHaveBeenCalled();
});

it("scrubs legacy client reports again before persistence and fits long reports to storage limits", async () => {
  const values = vi.fn().mockResolvedValue(undefined);
  m.getDb.mockReturnValue({ insert: () => ({ values }) });
  const res = response();
  await routes.get("/api/errors/client")!({
    header: () => "test-agent",
    body: {
      message: "Failed https://reader:password@thedesk.au/ask?q=private " + "x".repeat(700),
      stack: "url: https://thedesk.au/unsubscribe?token=private#fragment\n" + "s".repeat(9_000),
      url: "https://reader:password@thedesk.au/ask?q=private#fragment",
    },
  } as unknown as Request, res as unknown as Response);
  const stored = values.mock.calls[0]![0];
  expect(stored.message).toHaveLength(512);
  expect(stored.stack).toHaveLength(8_000);
  expect(stored.route).toBe("https://thedesk.au/ask");
  for (const secret of ["private", "password", "fragment", "reader:"]) expect(JSON.stringify(stored)).not.toContain(secret);
  expect(res.status).toHaveBeenCalledWith(204);
});
