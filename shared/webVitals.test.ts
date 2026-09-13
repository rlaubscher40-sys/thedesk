import { expect, it } from "vitest";
import { summariseVitals, webVitalSchema } from "./webVitals";
it("keeps device cohorts separate and computes the nearest-rank p75", () => {
  const rows = summariseVitals(
    [100, 200, 300, 400].map((value) => ({ name: "INP", device: "mobile", value }))
  );
  expect(rows.find((row) => row.name === "INP" && row.device === "mobile")).toMatchObject({
    p75: 300,
    count: 4,
    target: 200,
  });
  expect(rows.find((row) => row.device === "desktop")?.p75).toBeNull();
});
it("rejects unbounded or identifying telemetry fields", () => {
  const valid = { id: "v6-12345678-123456", name: "LCP", value: 1200, path: "/", device: "mobile" };
  expect(webVitalSchema.safeParse(valid).success).toBe(true);
  expect(webVitalSchema.safeParse({ ...valid, email: "private@example.com" }).success).toBe(false);
  expect(webVitalSchema.safeParse({ ...valid, value: Infinity }).success).toBe(false);
});
