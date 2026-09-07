import type { Request } from "express";
import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeAnonymousAsk,
  consumeAnonymousCard,
  resetAskQuotaForTests,
} from "./askQuota";

function req(ip: string): Request {
  return { ip } as Request;
}

describe("Ask anonymous quotas", () => {
  beforeEach(() => resetAskQuotaForTests());

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
