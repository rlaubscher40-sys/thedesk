import type { Request } from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  consumeAnonymousAsk,
  consumeAnonymousAskAttempt,
  consumeAnonymousCard,
  reserveAnonymousAsk,
  resetAskQuotaForTests,
} from "./askQuota";
const req = (ip: string) => ({ ip }) as Request;
beforeEach(resetAskQuotaForTests);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("reserves concurrently and refunds each reservation only once", async () => {
  const r = req("203.0.113.1");
  const reservations = await Promise.all(Array.from({ length: 6 }, () => reserveAnonymousAsk(r)));
  expect(reservations.filter((x) => x.allowed)).toHaveLength(3);
  const first = reservations.find((x) => x.allowed)!;
  await first.release();
  await first.release();
  expect((await reserveAnonymousAsk(r)).allowed).toBe(true);
  expect((await reserveAnonymousAsk(r)).allowed).toBe(false);
});
it("does not refund yesterday into today", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T23:59:59Z"));
  const r = req("203.0.113.1");
  const old = await reserveAnonymousAsk(r);
  vi.setSystemTime(new Date("2026-09-09T00:00:01Z"));
  await consumeAnonymousAsk(r);
  await old.release();
  expect((await consumeAnonymousAsk(r)).remaining).toBe(1);
});
it("keeps three answer and eight render allowances separate", async () => {
  const r = req("203.0.113.1");
  for (let i = 0; i < 8; i++) expect((await consumeAnonymousCard(r)).allowed).toBe(true);
  expect((await consumeAnonymousCard(r)).allowed).toBe(false);
  for (let i = 0; i < 3; i++) expect((await consumeAnonymousAsk(r)).allowed).toBe(true);
  expect((await consumeAnonymousAsk(r)).allowed).toBe(false);
  expect((await consumeAnonymousAsk(req("203.0.113.2"))).allowed).toBe(true);
});
it("shares the daily allowance across an IPv6 /56", async () => {
  for (let i = 0; i < 3; i++) await consumeAnonymousAsk(req(`2001:4860:1234:5600::${i + 1}`));
  expect((await consumeAnonymousAsk(req("2001:4860:1234:56ff::9"))).allowed).toBe(false);
  expect((await consumeAnonymousAsk(req("2001:4860:1234:5700::9"))).allowed).toBe(true);
});
it("bounds anonymous model work globally across clients", async () => {
  vi.stubEnv("ANONYMOUS_AI_DAILY_ATTEMPTS", "2");
  expect((await consumeAnonymousAskAttempt(req("203.0.113.1"))).allowed).toBe(true);
  expect((await consumeAnonymousAskAttempt(req("203.0.113.2"))).allowed).toBe(true);
  expect((await consumeAnonymousAskAttempt(req("203.0.113.3"))).allowed).toBe(false);
});
