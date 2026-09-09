import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSource, fetchSourceResponse, selectResource } from "./fetch";
afterEach(() => vi.unstubAllGlobals());
describe("registered publisher downloads", () => {
  it("rejects a redirect away from the registered publisher before fetching it", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })
    );
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 100)).rejects.toThrow(
      "registered publisher"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bounds streamed responses without trusting Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("123456"))
    );
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 5)).rejects.toThrow(
      "download limit"
    );
  });
  it("surfaces denied access without retrying through another host", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchSource("https://www.nsw.gov.au/data", "nsw-bond-rents", 100)).rejects.toThrow(
      "HTTP 403"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("selects the newest completed monthly lodgement file, excluding annual and refund files", () => {
    const html = [
      "rentalbond_lodgements_july_2026.xlsx",
      "rentalbond_lodgements_august_2026.xlsx",
      "rentalbond_lodgements_september_2026.xlsx",
      "rentalbond_lodgements_year_2026.xlsx",
      "rentalbond_refunds_august_2026.xlsx",
    ]
      .map((file) => `<a href="/sites/${file}">Data</a>`)
      .join("");
    expect(selectResource("nsw-bond-rents", html, new Date("2026-09-09"))).toMatchObject({
      period: "2026-08",
      url: expect.stringContaining("august"),
    });
  });
  it("requires an explicit boundary review when ABS changes geography edition", () => {
    const html =
      'Geographic areas Australian Statistical Geography Standard (ASGS) Edition 4<a href="/32180DS0001_2024-25.xlsx">Data</a>';
    expect(() => selectResource("abs-sa2-population", html, new Date("2026-09-09"))).toThrow(
      "boundary edition"
    );
  });
});

const url = "https://www.nsw.gov.au/file.xlsx";
const cache = {
  resourceUrl: url,
  finalUrl: url,
  parserVersion: "local-data-v1",
  downloadedAt: "2026-09-09T00:00:00Z",
  etag: '"v1"',
  lastModified: "Tue, 08 Sep 2026 00:00:00 GMT",
};
it("uses ETag first and accepts a bodyless 304", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, cache)).toEqual({
    status: "unchanged",
  });
  expect(fetch.mock.calls[0]![1]).toMatchObject({ headers: { "If-None-Match": '"v1"' } });
  expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("If-Modified-Since");
});
it("uses Last-Modified when no ETag is available", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetch);
  await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, { ...cache, etag: undefined });
  expect(fetch.mock.calls[0]![1]).toMatchObject({
    headers: { "If-Modified-Since": cache.lastModified },
  });
});
it("reads a revised 200 response even after sending validators", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("revision", { headers: { etag: '"v2"' } }))
  );
  expect(await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, cache)).toMatchObject({
    status: "downloaded",
    bytes: Buffer.from("revision"),
    etag: '"v2"',
    finalUrl: url,
  });
});
it("never sends validators to a changed redirect target", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/new.xlsx" } }))
    .mockResolvedValueOnce(new Response("revision"));
  vi.stubGlobal("fetch", fetch);
  await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, cache);
  expect(fetch.mock.calls[1]![1].headers).not.toHaveProperty("If-None-Match");
});
it("can revalidate the previously stored exact redirect target", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "/download.xlsx" } })
    )
    .mockResolvedValueOnce(new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetch);
  expect(
    await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, {
      ...cache,
      finalUrl: "https://www.nsw.gov.au/download.xlsx",
    })
  ).toEqual({ status: "unchanged" });
  expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("If-None-Match");
  expect(fetch.mock.calls[1]![1].headers).toHaveProperty("If-None-Match", '"v1"');
});
it("rejects unsolicited 304 and partial file responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 304 }))
  );
  await expect(fetchSourceResponse(url, "nsw-bond-rents", 100)).rejects.toThrow(
    "without a matching"
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("partial", { status: 206 }))
  );
  await expect(fetchSourceResponse(url, "nsw-bond-rents", 100)).rejects.toThrow("HTTP 206");
});
it("ignores malformed or oversized cached validators", async () => {
  const fetch = vi.fn(async () => new Response("file"));
  vi.stubGlobal("fetch", fetch);
  await fetchSourceResponse(url, "nsw-bond-rents", 100, undefined, {
    ...cache,
    etag: '"' + "x".repeat(512) + '"',
    lastModified: "invalid\r\nheader",
  });
  expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("If-None-Match");
  expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("If-Modified-Since");
});
