import { expect, it } from "vitest";
import { marketResearchBridge, socialArrivalPath } from "./entryRoutes";
it("routes only the known bio arrival and preserves attribution and post query", () => {
  const query = "utm_source=instagram&utm_campaign=bio&story=3960085&utm_medium=social";
  expect(socialArrivalPath("/", query)).toBe(`/social?${query}`);
  expect(socialArrivalPath("/story/3960085", query)).toBeNull();
  expect(socialArrivalPath("/social", query)).toBeNull();
  expect(socialArrivalPath("/", "utm_source=instagram&utm_campaign=property_daily")).toBeNull();
  expect(socialArrivalPath("/", "next=https://outside.example")).toBeNull();
});
it("bridges only the identified council label without broad suffix stripping", () => {
  expect(marketResearchBridge("Townsville (C)", "QLD", "LGA")?.slug).toBe("townsville");
  for (const [q, state, kind] of [
    ["Townsville (C)", "NSW", "LGA"],
    ["Townsville (C)", "QLD", "suburb"],
    ["Townsville (C)", null, null],
    ["Newcastle (C)", "NSW", "LGA"],
    ["Townsville (R)", "QLD", "LGA"],
  ]) {
    expect(marketResearchBridge(q!, state, kind)).toBeUndefined();
  }
});
