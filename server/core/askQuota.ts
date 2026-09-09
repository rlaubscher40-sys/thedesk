import type { Request } from "express";
import { chargeBudgets, budgetUsed, refundBudget, resetDemoSecurityState } from "../db/security";
import { clientIdentity, dayWindow, privateKey } from "./publicLimits";
const ANONYMOUS_ASK_LIMIT = 3,
  ANONYMOUS_CARD_LIMIT = 8;
export type QuotaResult = { allowed: boolean; remaining: number; limit: number };
function quotaKey(req: Request, namespace: string, day: string) {
  return privateKey(namespace, day + ":" + clientIdentity(req));
}
async function consume(req: Request, namespace: string, limit: number): Promise<QuotaResult> {
  const { day, expiresMs } = dayWindow();
  const key = quotaKey(req, namespace, day);
  const allowed = await chargeBudgets([{ key, limit, expiresMs }]);
  return { allowed, remaining: allowed ? Math.max(0, limit - (await budgetUsed(key))) : 0, limit };
}
export function consumeAnonymousAsk(req: Request) {
  return consume(req, "ask", ANONYMOUS_ASK_LIMIT);
}
/** Global anonymous attempt ceiling bounds spend even across many client addresses. */
export async function consumeAnonymousAskAttempt(req: Request): Promise<QuotaResult> {
  const { day, expiresMs } = dayWindow();
  const key = quotaKey(req, "ask-attempt", day);
  const globalLimit = Number(process.env.ANONYMOUS_AI_DAILY_ATTEMPTS || 200);
  const allowed = await chargeBudgets([
    { key, limit: 12, expiresMs },
    {
      key: "anonymous-ai-global:" + day,
      limit: Number.isSafeInteger(globalLimit) && globalLimit > 0 ? globalLimit : 200,
      expiresMs,
    },
  ]);
  return { allowed, remaining: allowed ? Math.max(0, 12 - (await budgetUsed(key))) : 0, limit: 12 };
}
export async function reserveAnonymousAsk(req: Request) {
  const { day } = dayWindow();
  const key = quotaKey(req, "ask", day);
  const quota = await consumeAnonymousAsk(req);
  let settled = !quota.allowed;
  return {
    ...quota,
    commit() {
      settled = true;
    },
    async release() {
      if (settled) return;
      settled = true;
      await refundBudget(key);
    },
  };
}
export function consumeAnonymousCard(req: Request) {
  return consume(req, "ask-card", ANONYMOUS_CARD_LIMIT);
}
export function resetAskQuotaForTests() {
  resetDemoSecurityState();
}
