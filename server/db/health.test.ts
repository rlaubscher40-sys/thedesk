import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ values: vi.fn() }));
vi.mock("./client", () => ({ getDb: () => ({ insert: () => ({ values: m.values }) }) }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { recordServerError } from "./health";
it("persists a long Instagram arrival error within database limits and removes tracking queries", async () => {
  await recordServerError({
    message: "x".repeat(700),
    route: "https://thedesk.au/story/3870099?utm_source=instagram&fbclid=" + "a".repeat(300),
    userAgent: "a".repeat(400),
    method: "CLIENT",
  });
  expect(m.values).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "x".repeat(512),
      route: "https://thedesk.au/story/3870099",
      userAgent: "a".repeat(256),
    })
  );
});
