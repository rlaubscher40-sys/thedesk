import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSource, selectResource } from "./fetch";
afterEach(() => vi.unstubAllGlobals());
describe("registered publisher downloads", () => {
  it("rejects a redirect away from the registered publisher before fetching it", async () => {
    const fetch = vi.fn(async () => new Response(null, {status: 302, headers: {location: "http://127.0.0.1/private"}}));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 100)).rejects.toThrow("registered publisher");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bounds streamed responses without trusting Content-Length", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("123456")));
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 5)).rejects.toThrow("download limit");
  });
  it("surfaces denied access without retrying through another host", async () => {
    const fetch = vi.fn(async () => new Response(null, {status: 403})); vi.stubGlobal("fetch", fetch);
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 100)).rejects.toThrow("HTTP 403"); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("selects the newest completed monthly lodgement file, excluding annual and refund files", () => {
    const html = ['rentalbond_lodgements_july_2026.xlsx', 'rentalbond_lodgements_august_2026.xlsx', 'rentalbond_lodgements_september_2026.xlsx', 'rentalbond_lodgements_year_2026.xlsx', 'rentalbond_refunds_august_2026.xlsx'].map(file => `<a href="/sites/${file}">Data</a>`).join("");
    expect(selectResource("nsw-bond-rents", html, new Date("2026-09-09"))).toMatchObject({period: "2026-08", url: expect.stringContaining("august")});
  });
  it("requires an explicit boundary review when ABS changes geography edition", () => {
    const html = 'Geographic areas Australian Statistical Geography Standard (ASGS) Edition 4<a href="/32180DS0001_2024-25.xlsx">Data</a>';
    expect(() => selectResource("abs-sa2-population", html, new Date("2026-09-09"))).toThrow("boundary edition");
  });
});
