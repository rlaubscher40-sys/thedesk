import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../db/schema";
import { demoUser, isDemoMode } from "../demo/store";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  // In demo mode there's no auth backend, pretend every request is the
  // configured admin user so the whole UI is reachable without a sign-in.
  if (isDemoMode()) {
    return { req: opts.req, res: opts.res, user: demoUser };
  }

  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
