import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { fetchCashRate, parseCashRate } from "./lib/rbaCashRate";
// Exact first three columns and final five observations of RBA F1, fetched 2026-09-08.
const csv = readFileSync(new URL("./fixtures/rba-cash-daily.csv", import.meta.url), "utf8");
const now = new Date("2026-09-08T12:00:00Z");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("reads the daily target from current unquoted RBA CSV and preserves its observation date", () => {
  expect(parseCashRate(csv, now)).toEqual({ rate: 4.35, asOf: new Date("2026-09-07") });
  expect(parseCashRate(csv.replace("07-Sep-2026,4.35", '"07-Sep-2026","4.35"'), now)).toEqual(
    parseCashRate(csv, now)
  );
});

it("recognises the unfinished Sydney day while UTC is still yesterday", () => {
  expect(parseCashRate(csv, new Date("2026-09-07T23:00:00Z"))).toEqual({
    rate: 4.35, asOf: new Date("2026-09-07"),
  });
});

it("uses the Sydney day during daylight saving too", () => {
  const summer = csv.replaceAll("Sep", "Jan");
  expect(parseCashRate(summer, new Date("2026-01-07T13:30:00Z"))).toEqual({
    rate: 4.35, asOf: new Date("2026-01-07"),
  });
});

it("still rejects a pending row beyond its grace window and a genuinely future blank row", () => {
  expect(() => parseCashRate(csv, new Date("2026-09-13T01:00:00Z"))).toThrow("unavailable");
  expect(() => parseCashRate(csv.replace("08-Sep-2026,,", "09-Sep-2026,,"), now))
    .toThrow("unavailable");
});

it("handles the exact overnight production failure without relabelling the prior observation", () => {
  expect(parseCashRate(csv, new Date("2026-09-08T15:38:57.888Z"))).toEqual({
    rate: 4.35, asOf: new Date("2026-09-07"),
  });
  expect(parseCashRate(csv, new Date("2026-09-09T01:00:00Z"))).toEqual({
    rate: 4.35, asOf: new Date("2026-09-07"),
  });
});

it("permits one pending publication row across a long weekend and enforces the bound", () => {
  const friday = csv.replaceAll("08-Sep-2026", "11-Sep-2026")
    .replaceAll("07-Sep-2026", "10-Sep-2026");
  expect(parseCashRate(friday, new Date("2026-09-14T23:00:00Z"))).toEqual({
    rate: 4.35, asOf: new Date("2026-09-10"),
  });
  expect(() => parseCashRate(friday, new Date("2026-09-15T23:00:00Z"))).toThrow("unavailable");
});

it("requires a unique matching publication date before skipping a blank row", () => {
  const overnight = new Date("2026-09-08T15:38:57.888Z");
  for (const invalid of [
    csv.replace("Publication date,08-Sep-2026", "Publication date,07-Sep-2026"),
    csv.replace(/^Publication date,.*\r?\n/m, ""),
    csv + "\nPublication date,08-Sep-2026,08-Sep-2026\n",
    csv.replace("Publication date,08-Sep-2026", "Publication date,invalid"),
  ]) expect(() => parseCashRate(invalid, overnight)).toThrow("unavailable");
});

it("never skips a second missing observation or a duplicate newest date", () => {
  const overnight = new Date("2026-09-08T15:38:57.888Z");
  expect(() => parseCashRate(csv.replace("07-Sep-2026,4.35", "07-Sep-2026,"), overnight))
    .toThrow("unavailable");
  expect(() => parseCashRate(csv + "\n08-Sep-2026,4.35,\n", overnight)).toThrow("unavailable");
});

it("uses a newly populated latest target rather than retaining the previous rate", () => {
  expect(parseCashRate(csv.replace("08-Sep-2026,,", "08-Sep-2026,4.10,"),
    new Date("2026-09-08T15:38:57.888Z"))).toEqual({
    rate: 4.10, asOf: new Date("2026-09-08"),
  });
});

it("keeps the independent stale-observation check after allowing a pending publication row", () => {
  const old = csv.replace(/0[2-7]-Sep-2026/g, (date) => date.replace("Sep", "Aug"));
  expect(() => parseCashRate(old, new Date("2026-09-08T15:38:57.888Z"))).toThrow("Stale");
});

it("returns successful data without reporting a source error", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(csv)));
  const report = vi.fn();
  expect(await fetchCashRate(report)).toEqual({ rate: 4.35, asOf: new Date("2026-09-07") });
  expect(report).not.toHaveBeenCalled();
});

it("reports the HTTP status without including the response body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private response", { status: 403 })));
  const report = vi.fn();
  expect(await fetchCashRate(report)).toBeNull();
  expect(report).toHaveBeenCalledWith(expect.stringContaining("RBA F1 HTTP 403"));
  expect(report.mock.calls[0]![0]).not.toContain("private response");
});

it("distinguishes oversized responses, timeouts and validation failures", async () => {
  const report = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(csv, {
    headers: { "content-length": "1000001" },
  })));
  expect(await fetchCashRate(report)).toBeNull();
  expect(report).toHaveBeenLastCalledWith(expect.stringContaining("size limit"));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
  expect(await fetchCashRate(report)).toBeNull();
  expect(report).toHaveBeenLastCalledWith(expect.stringContaining("timed out"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not a CSV")));
  expect(await fetchCashRate(report)).toBeNull();
  expect(report).toHaveBeenLastCalledWith(expect.stringContaining("validation: Missing or duplicate"));
});

it("does not leak arbitrary network error text into the report", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive-provider-details")));
  const report = vi.fn();
  expect(await fetchCashRate(report)).toBeNull();
  expect(report.mock.calls[0]![0]).toContain("network or response-read failure");
  expect(report.mock.calls[0]![0]).not.toContain("sensitive-provider-details");
});
it("does not substitute an older rate when the latest completed observation is missing", () => {
  expect(() => parseCashRate(csv.replace("07-Sep-2026,4.35", "07-Sep-2026,"), now)).toThrow(
    "unavailable"
  );
});
it("rejects the monthly series, changed identity, stale and future observations", () => {
  expect(() => parseCashRate(csv.replace("FIRMMCRTD", "FIRMMCRT"), now)).toThrow("series");
  expect(() => parseCashRate(csv.replace("Cash Rate Target", "Interbank rate"), now)).toThrow(
    "Title"
  );
  expect(() => parseCashRate(csv, new Date("2026-10-08"))).toThrow();
  expect(() => parseCashRate(csv.replace("08-Sep-2026,,", "09-Sep-2026,4.35,"), now)).toThrow(
    "future"
  );
});
