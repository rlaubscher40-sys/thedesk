import { expect, it } from "vitest";
import { selectSignal, signalSharePath } from "./signalSnapshot";
it("never replaces a missing requested signal with the ranked leader", () => {
  const leader = { metric: { metricKey: "asx_200" } };
  expect(selectSignal([leader], "missing", leader)).toBeNull();
  expect(selectSignal([leader], "", leader)).toBeNull();
  expect(selectSignal([leader], "asx_200", null)).toBe(leader);
  expect(selectSignal([leader], null, leader)).toBe(leader);
});
it("keeps the evidence identifier when switching between number and chart", () => {
  const id = "a".repeat(64);
  expect(signalSharePath("cash_rate", id, true)).toBe(`/signals?metric=cash_rate&snapshot=${id}&view=chart`);
  expect(signalSharePath("cash_rate", id)).toBe(`/signals?metric=cash_rate&snapshot=${id}`);
});
