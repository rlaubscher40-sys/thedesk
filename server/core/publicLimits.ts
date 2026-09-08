import { createHmac } from "node:crypto";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { chargeBudgets, refundBudget } from "../db/security";
import { signingSecret } from "./env";
export function clientIdentity(req: Pick<Request, "ip">): string {
  return ipKeyGenerator(req.ip || "unknown", 56);
}
export function privateKey(namespace: string, value: string): string {
  return (
    namespace +
    ":" +
    createHmac("sha256", signingSecret())
      .update(namespace + ":" + value)
      .digest("hex")
  );
}
export function dayWindow() {
  const n = Math.floor(Date.now() / 86400000);
  return { day: String(n), expiresMs: (n + 1) * 86400000 };
}
/** Recipient controls apply to every actual send, including already-confirmed nudges. */
export async function reserveSubscriptionEmail(req: Pick<Request, "ip">, email: string) {
  const { day, expiresMs } = dayWindow();
  return chargeBudgets([
    { key: privateKey("email-cooldown", email), limit: 1, expiresMs: Date.now() + 15 * 60000 },
    { key: privateKey("email-recipient", day + ":" + email), limit: 4, expiresMs },
    { key: privateKey("email-client", day + ":" + clientIdentity(req)), limit: 10, expiresMs },
    { key: "email-global:" + day, limit: 500, expiresMs },
  ]);
}

/** Allow recovery after a failed delivery, while preserving daily abuse budgets. */
export function releaseSubscriptionCooldown(email: string) {
  return refundBudget(privateKey("email-cooldown", email));
}
