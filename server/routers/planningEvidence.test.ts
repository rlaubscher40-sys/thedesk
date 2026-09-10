import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../planning/read", () => ({getNswPlanningPilot:vi.fn(),getStoredPlanningPilot:vi.fn()}));
import { getNswPlanningPilot, getStoredPlanningPilot } from "../planning/read";
import { metricsRouter } from "./metrics";
import type { TrpcContext } from "../core/context";
const caller = metricsRouter.createCaller({req:{},res:{},user:null} as TrpcContext);
beforeEach(() => vi.resetAllMocks());
it("preserves the default live panel but routes a pinned link only to stored evidence", async () => {
  await caller.planningPilot();
  expect(getNswPlanningPilot).toHaveBeenCalledTimes(1);
  await caller.planningPilot({period:"2026-08",fingerprint:"a".repeat(64)});
  expect(getStoredPlanningPilot).toHaveBeenCalledWith("2026-08","a".repeat(64));
  expect(getNswPlanningPilot).toHaveBeenCalledTimes(1);
});
it("invalid pins fail input validation rather than invoking latest-period collection", async () => {
  for (const input of [{period:"2026-13"},{period:"2026-08",fingerprint:"bad"},{}]) {
    await expect(caller.planningPilot(input as {period:string})).rejects.toMatchObject({code:"BAD_REQUEST"});
  }
  expect(getStoredPlanningPilot).not.toHaveBeenCalled();
  expect(getNswPlanningPilot).not.toHaveBeenCalled();
});
