import { afterEach, describe, expect, it, vi } from "vitest";
import { getCityRents, parseAbsRents } from "./absRents";
import { invalidate } from "../core/cache";
import { latestRent, rentGap, rentIsOlder } from "../../shared/cityRents";

const header =
  "DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,OBS_STATUS,DECIMALS,OBS_COMMENT,BASE_PERIOD";
const row = (region = "5", period = "2026-07", value = "5.3", status = "") =>
  `ABS:CPI(2.0.0),3,30014,10,${region},M,${period},${value},PCT,${status},,,25`;
const csv = (...rows: string[]) => [header, ...rows].join("\r\n");
const now = "2026-09-07T00:00:00Z";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  invalidate("abs:rents:");
});

describe("ABS capital-city rent observations", () => {
  it("uses verified geography codes and actual periods, including signed and zero rates", () => {
    const data = parseAbsRents(
      csv(row(), row("3", "2026-07", "4.6"), row("4", "2026-07", "0"), row("8", "2026-07", "-0.2")),
      now
    );
    expect(latestRent(data, " perth ")).toMatchObject({
      city: "Perth",
      period: "2026-07",
      annualPercent: 5.3,
    });
    expect(latestRent(data, "Adelaide")?.annualPercent).toBe(0);
    expect(latestRent(data, "Canberra")?.annualPercent).toBe(-0.2);
    expect(latestRent(data, "Townsville")).toBeUndefined();
    expect(latestRent(data, "Perth suburbs")).toBeUndefined();
    expect(rentGap(latestRent(data, "Perth"), latestRent(data, "Brisbane"), now)).toBe(0.7);
  });
  it.each(["", "NaN", "Infinity", "5%"])(
    "does not turn invalid %s into zero or fall back past a missing latest value",
    (value) => {
      expect(
        parseAbsRents(csv(row("5", "2026-06"), row("5", "2026-07", value)), now).observations
      ).toEqual([]);
    }
  );
  it.each(["s", "q", "n", "w", "unknown"])(
    "withholds %s statuses instead of using an older observation",
    (status) => {
      expect(
        parseAbsRents(csv(row("5", "2026-06"), row("5", "2026-07", "5.3", status)), now)
          .observations
      ).toEqual([]);
    }
  );
  it("retains preliminary and revised labels and handles CSV quoting", () => {
    const data = parseAbsRents(
      csv(
        row("5", "2026-07", "5.3", "p").replace(
          ",,,25",
          ',,"Revised, with ""note""\ncontinued",25'
        ),
        row("3", "2026-07", "4.6", "r")
      ),
      now
    );
    expect(data.observations.map((r) => r.status)).toEqual(["p", "r"]);
  });
  it.each([
    row().replace(",3,30014", ",2,30014"),
    row().replace("30014", "115522"),
    row().replace(",10,", ",20,"),
    row().replace(",M,", ",Q,"),
    row().replace("PCT", "IN"),
    row("50"),
    row("5", "2026-13"),
    row("5", "2026-09"),
    row().replace("2.0.0", "3.0.0"),
  ])("rejects unexpected series identity or period", (bad) =>
    expect(() => parseAbsRents(csv(bad), now)).toThrow()
  );
  it("rejects duplicate observations, malformed headers and oversized bodies", () => {
    expect(() => parseAbsRents(csv(row(), row()), now)).toThrow();
    expect(() => parseAbsRents(csv(row()).replace("OBS_STATUS", "OTHER"), now)).toThrow();
    expect(() => parseAbsRents('"unclosed', now)).toThrow();
    expect(() => parseAbsRents("x".repeat(64_001), now)).toThrow();
  });
  it("withholds gaps for different months, older data and the same city", () => {
    const a = { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "" as const };
    expect(rentGap(a, { ...a, city: "Brisbane", period: "2026-06" }, now)).toBeNull();
    expect(rentGap(a, { ...a, city: "Brisbane" }, "2026-11-01")).toBeNull();
    expect(rentGap(a, a, now)).toBeNull();
    expect(rentIsOlder(a, "2026-10-01")).toBe(false);
  });
  it("coalesces concurrent reads and caches successful requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(csv(row()), {
          headers: { "content-type": "application/vnd.sdmx.data+csv; charset=utf-8" },
        })
      );
    vi.stubGlobal("fetch", fetcher);
    const results = await Promise.all([getCityRents(), getCityRents()]);
    expect(results[0].status).toBe("available");
    expect(results[0]).toEqual(results[1]);
    await getCityRents();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("isolates outages and short-caches failures without invented observations", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    expect(await getCityRents()).toEqual({
      status: "unavailable",
      retrievedAt: null,
      observations: [],
    });
    await getCityRents();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    new Response("oops", { status: 503 }),
    new Response("<html/>", { headers: { "content-type": "text/html" } }),
    new Response("x".repeat(64_001), { headers: { "content-type": "text/csv" } }),
  ])("rejects error, HTML and oversized streamed responses", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    expect((await getCityRents()).status).toBe("unavailable");
  });
});
