import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createBoundedCache } from "./cache";
import { reserveSubscriptionEmail } from "./publicLimits";
import { resetDemoSecurityState } from "../db/security";
import { publicEdition } from "./publicEdition";
import { totpAt, verifyTotp } from "./totp";
import { protectBrowserMutation } from "./csrf";
import type { Request } from "express";
import type { Edition } from "../db/schema";
beforeEach(resetDemoSecurityState);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("concurrent email requests to one recipient reserve only one send", async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      reserveSubscriptionEmail({ ip: "203.0.113.1" }, "reader@example.invalid")
    )
  );
  expect(results.filter(Boolean)).toHaveLength(1);
});
it("recipient cooldown applies across client addresses, rolls forward, and daily ceiling remains", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T10:00:00Z"));
  for (let i = 0; i < 4; i++) {
    expect(
      await reserveSubscriptionEmail({ ip: `203.0.113.${i + 1}` }, "reader@example.invalid")
    ).toBe(true);
    expect(await reserveSubscriptionEmail({ ip: "203.0.113.99" }, "reader@example.invalid")).toBe(
      false
    );
    vi.advanceTimersByTime(15 * 60000 + 1);
  }
  expect(await reserveSubscriptionEmail({ ip: "203.0.113.100" }, "reader@example.invalid")).toBe(
    false
  );
});
it("public edition allow-list excludes drafts and future unknown columns", () => {
  const ed = {
    id: 1,
    substackDraftTitle: "secret",
    substackDraftBody: "secret",
    headlineVariants: ["secret"],
    newPrivateColumn: "secret",
  } as unknown as Edition;
  expect(JSON.stringify(publicEdition(ed))).not.toContain("secret");
  expect(publicEdition(ed)).not.toHaveProperty("substackDraftBody");
});
it("cache evicts LRU entries, bounds byte count, and actively purges expiry", async () => {
  vi.useFakeTimers();
  const c = createBoundedCache({ maxEntries: 2, maxBytes: 128, maxInflight: 2 });
  await c.cached("a", 10, async () => 1);
  await c.cached("b", 10, async () => 2);
  await c.cached("c", 10, async () => 3);
  expect(c.stats().entries).toBe(2);
  expect(c.stats().bytes).toBeLessThanOrEqual(128);
  expect(await c.cached("a", 10, async () => 99)).toBe(99);
  await c.cached("large", 10, async () => Buffer.alloc(1024));
  expect(c.stats().bytes).toBeLessThanOrEqual(128);
  vi.advanceTimersByTime(11);
  c.purge();
  expect(c.stats().entries).toBe(0);
});
it("cache bounds distinct loads and cannot republish an invalidated stale response", async () => {
  const c = createBoundedCache({ maxEntries: 2, maxBytes: 1024, maxInflight: 1 });
  let resolve!: (n: number) => void;
  const first = c.cached(
    "a",
    1000,
    () =>
      new Promise<number>((r) => {
        resolve = r;
      })
  );
  await Promise.resolve();
  await expect(c.cached("b", 1000, async () => 2)).rejects.toThrow("capacity");
  c.invalidate("a");
  expect(await c.cached("a", 1000, async () => 3)).toBe(3);
  resolve(1);
  expect(await first).toBe(1);
  expect(await c.cached("a", 1000, async () => 4)).toBe(3);
});
it("TOTP matches RFC 6238 SHA1 test vector and rejects invalid codes", () => {
  // RFC secret 12345678901234567890, timestamp 59 => 94287082 (six-digit suffix).
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totpAt(secret, 1)).toBe("287082");
  expect(verifyTotp(secret, "287082", 59000)).toBe(1);
  expect(verifyTotp(secret, "123456", 59000)).toBeNull();
});
it("cross-origin browser mutation is denied while same-origin and header-only cron are accepted", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://thedesk.au");
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const make = (headers: Record<string, string>) =>
    ({ method: "POST", get: (k: string) => headers[k] }) as Request;
  protectBrowserMutation(make({ origin: "https://evil.example" }), res as any, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  protectBrowserMutation(make({ origin: "https://thedesk.au" }), res as any, next);
  protectBrowserMutation(make({}), res as any, next);
  expect(next).toHaveBeenCalledTimes(2);
});
