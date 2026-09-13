import { expect, it } from "vitest";
import { nextPublicationSlot } from "./nextPublication";
it("finds the Sunday slot in Sydney, including daylight saving", () => {
  expect(nextPublicationSlot(new Date("2026-09-12T20:00:00Z"))).toMatchObject({
    name: "Weekly recap",
    date: "2026-09-13",
    at: "09:30",
  });
  expect(nextPublicationSlot(new Date("2026-10-03T20:00:00Z"))).toMatchObject({
    name: "Weekly recap",
    date: "2026-10-04",
    at: "09:30",
  });
});
it("honours the monthly replacement instead of offering a duplicate number slot", () => {
  expect(nextPublicationSlot(new Date("2026-10-01T00:00:00Z"))).toMatchObject({
    name: "Monthly review",
    date: "2026-10-01",
    at: "12:30",
  });
});
