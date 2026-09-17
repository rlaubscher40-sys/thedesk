import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getStateLabour, parseAbsLabour } from "./absLabour";
import { invalidate } from "../core/cache";
import { readStateLabour } from "../../shared/stateLabour";
const html = readFileSync(new URL("./fixtures/abs-state-labour.html", import.meta.url), "utf8");
const now = "2026-09-17T11:00:00Z";
beforeEach(() => {
  invalidate("abs:labour:");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  invalidate("abs:labour:");
});
it("reads 32 exact measures from all eight trend jurisdictions", () => {
  const data = parseAbsLabour(html, now);
  expect(data.period).toBe("2026-07");
  expect(data.observations).toHaveLength(8);
  expect(data.sourceUrl).toMatch(/\/jul-2026$/);
  expect(data.observations.find((r) => r.state === "WA")).toEqual({
    state: "WA",
    employedPeople: 1682900,
    employmentMonthlyPercent: 0,
    unemploymentPercent: 4.3,
    participationPercent: 68.5,
  });
  expect(data.observations.find((r) => r.state === "ACT")?.employedPeople).toBe(277800);
});
it.each([
  ["Labour Force, Australia", "Labour Account, Australia"],
  ["July 2026 - Trend", "July 2026 - Seasonally adjusted"],
  ["Reference period", "Release date"],
  ["Northern Territory", "Darwin"],
  ["Participation rate</th>", "Participation ratio</th>"],
  ["4,564,800", "4,564.8"],
  ["4,564,800", "4,56,480"],
  ["4,564,800", "np"],
  [">66.2%<", ">166.2%<"],
  [">66.2%<", ">66.2 pts<"],
])("rejects changed meaning or unavailable values: %s", (before, after) => {
  expect(html).toContain(before);
  expect(() => parseAbsLabour(html.replace(before, after), now)).toThrow();
});
it("rejects duplicate tables/rows, spans and future months", () => {
  const table = html.match(/<table[\s\S]*<\/table>/)![0];
  expect(() => parseAbsLabour(html + table, now)).toThrow();
  const row = html.match(/<tr[^>]*><th[^>]*>Employed people<\/th>[\s\S]*?<\/tr>/)![0];
  expect(() => parseAbsLabour(html.replace("</tbody>", row + "</tbody>"), now)).toThrow();
  expect(() => parseAbsLabour(html.replace("<td", '<td colspan="2"'), now)).toThrow();
  expect(() => parseAbsLabour(html, "2026-07-30T00:00:00Z")).toThrow();
});
it("does not substitute stale or wrong periods or capital geographies", () => {
  const data = parseAbsLabour(html, now);
  expect(readStateLabour(data, "NSW", now)?.employedPeople).toBe(4564800);
  expect(readStateLabour(data, "Sydney", now)).toBeNull();
  expect(readStateLabour(data, "NSW", now, "2026-06")).toBeNull();
  expect(readStateLabour(data, "NSW", "2026-11-01")).toBeNull();
  expect(readStateLabour(data, "NSW", "2026-11-01", "2026-07")?.employedPeople).toBe(4564800);
});
it("coalesces fetches with a bounded cache", async () => {
  const fetcher = vi.fn(
    async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  );
  vi.stubGlobal("fetch", fetcher);
  const results = await Promise.all([getStateLabour(), getStateLabour(), getStateLabour()]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(results.every((r) => r.status === "available")).toBe(true);
});
it.each([
  () => new Response("Unavailable", { status: 503 }),
  () => new Response(html, { headers: { "content-type": "application/json" } }),
  () => new Response("x".repeat(2_000_001), { headers: { "content-type": "text/html" } }),
])("returns explicit unavailable on HTTP/type/streamed-byte failures", async (response) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response())
  );
  expect(await getStateLabour()).toMatchObject({
    status: "unavailable",
    observations: [],
    period: null,
  });
});
