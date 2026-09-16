import { expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
const read = vi.hoisted(() => vi.fn().mockResolvedValue({ available: true, sessions: 0 }));
vi.mock("../db", () => ({ readerJourney: read }));
import { analyticsRouter } from "./analytics";
it("keeps the session-action aggregate private and bounds its query window", async () => {
  const guest = analyticsRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
  await expect(guest.journey()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(read).not.toHaveBeenCalled();
  const admin = analyticsRouter.createCaller({
    req: {},
    res: {},
    user: { id: 1, role: "admin" },
  } as TrpcContext);
  await expect(admin.journey({ hours: 24 * 91 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(read).not.toHaveBeenCalled();
  expect(await admin.journey()).toEqual({ available: true, sessions: 0 });
  expect(read).toHaveBeenCalledExactlyOnceWith(168);
});
