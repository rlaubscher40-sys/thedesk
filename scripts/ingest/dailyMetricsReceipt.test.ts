import { expect, it } from "vitest";
import { verifyMetricReceipt } from "./dailyMetrics";

it("requires confirmation that every submitted metric was stored", () => {
  expect(() => verifyMetricReceipt({ success: true, count: 53 }, 53)).not.toThrow();
  for (const response of [{ success: true, count: 52 }, { success: true, count: 0 }, { success: false, count: 53 }, null, {}]) {
    expect(() => verifyMetricReceipt(response, 53)).toThrow("incomplete persistence");
  }
});
