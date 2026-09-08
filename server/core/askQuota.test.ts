import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeAnonymousAsk,
  consumeAnonymousCard,
  resetAskQuotaForTests,
  reserveAnonymousAsk,
} from "./askQuota";

function req(ip: string): Request {
  return { ip } as Request;
}

describe("Ask anonymous quotas", () => {
  beforeEach(() => resetAskQuotaForTests());
  afterEach(() => vi.useRealTimers());

  it("reserves concurrent requests and refunds each at most once", () => {
    const request = req("203.0.113.4");
    const first = reserveAnonymousAsk(request);
    const second = reserveAnonymousAsk(request);
    const third = reserveAnonymousAsk(request);
    expect(reserveAnonymousAsk(request).allowed).toBe(false);
    first.release();
    first.release();
    second.commit();
    second.release();
    expect(reserveAnonymousAsk(request)).toMatchObject({ allowed: true, remaining: 0 });
    expect(reserveAnonymousAsk(request).allowed).toBe(false);
    third.release();
    expect(reserveAnonymousAsk(request)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("does not refund yesterday's request into today's bucket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T23:59:59Z"));
    const request = req("203.0.113.5");
    const yesterday = reserveAnonymousAsk(request);
    vi.setSystemTime(new Date("2026-09-09T00:00:01Z"));
    consumeAnonymousAsk(request);
    yesterday.release();
    expect(consumeAnonymousAsk(request).remaining).toBe(1);
  });

  it("allows three free intelligence answers per client per day", () => {
    expect(consumeAnonymousAsk(req("203.0.113.1"))).toMatchObject({ allowed: true, remaining: 2 });
    expect(consumeAnonymousAsk(req("203.0.113.1"))).toMatchObject({ allowed: true, remaining: 1 });
    expect(consumeAnonymousAsk(req("203.0.113.1"))).toMatchObject({ allowed: true, remaining: 0 });
    expect(consumeAnonymousAsk(req("203.0.113.1"))).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("keeps anonymous clients in independent buckets", () => {
    for (let i = 0; i < 3; i++) consumeAnonymousAsk(req("203.0.113.1"));
    expect(consumeAnonymousAsk(req("203.0.113.2"))).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("uses a separate, larger render budget for share cards", () => {
    for (let i = 0; i < 8; i++) {
      expect(consumeAnonymousCard(req("203.0.113.3")).allowed).toBe(true);
    }
    expect(consumeAnonymousCard(req("203.0.113.3")).allowed).toBe(false);
    // Using the card budget must not consume an Ask answer.
    expect(consumeAnonymousAsk(req("203.0.113.3"))).toMatchObject({ allowed: true, remaining: 2 });
  });
});
