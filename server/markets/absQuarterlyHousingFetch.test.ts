import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../localData/workbook", () => ({ readWorkbook: vi.fn() }));
import { readWorkbook } from "../localData/workbook";
import { getHousingTransfers } from "./absQuarterlyHousing";
import { invalidate } from "../core/cache";
import { TRANSFER_SOURCE } from "../../shared/quarterlyHousing";
const url = TRANSFER_SOURCE.replace("latest-release", "jun-quarter-2026/643202.xlsx");
const html = `<h1>Total Value of Dwellings</h1><div class="field--name-field-abs-reference-period">Reference period June Quarter 2026</div><a href="${url}">Table 2</a>`;
beforeEach(() => {
  invalidate();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17"));
  vi.mocked(readWorkbook).mockResolvedValue(
    JSON.parse(
      readFileSync(new URL("./fixtures/abs-transfers.json", import.meta.url), "utf8"),
      (_, v) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/.test(v) ? new Date(v) : v
    )
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  invalidate();
});
it("coalesces requests, uses bounded exact downloads and caches successful parsing", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }))
    .mockResolvedValueOnce(
      new Response("xlsx", {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })
    );
  vi.stubGlobal("fetch", fetcher);
  const rows = await Promise.all([getHousingTransfers(), getHousingTransfers()]);
  expect(rows.every((r) => r.status === "available")).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]?.[0]).toBe(url);
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  await vi.advanceTimersByTimeAsync(61_000);
  await getHousingTransfers();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(["status", "mime", "oversize", "redirect", "changed source"])(
  "withholds a failed %s and retries after the failure cache expires",
  async (fault) => {
    const fetcher = vi.fn().mockImplementation(async () => {
      if (fault === "redirect") throw new TypeError("redirect rejected");
      return new Response(
        fault === "changed source" ? html.replace("643202.xlsx", "unexpected.xlsx") : html,
        {
          status: fault === "status" ? 503 : 200,
          headers: {
            "content-type": fault === "mime" ? "application/json" : "text/html",
            ...(fault === "oversize" ? { "content-length": "2000001" } : {}),
          },
        }
      );
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await getHousingTransfers()).toMatchObject({
      status: "unavailable",
      observations: [],
      period: null,
    });
    await getHousingTransfers();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readWorkbook).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    await getHousingTransfers();
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
);
