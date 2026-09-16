import { beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.dns }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { createSourceReader } from "./rss";
import { SOURCES } from "../sources";

const westpac = SOURCES.find((source) => source.name === "Westpac IQ Economics")!;
const title = "Leading Index suggests momentum a touch below trend";
function transport(size: number) {
  const html = `<html><script>${" ".repeat(size)}</script><a href="/economics/2026/09/leading-index-september-2026">${title}</a></html>`;
  mocks.request.mockImplementation((url, opts, callback) => {
    const req = new EventEmitter() as any;
    req.destroy = (error: Error) => {
      queueMicrotask(() => req.emit("error", error));
      return req;
    };
    req.end = () =>
      opts.lookup(url.hostname, { all: true }, (error: Error | null, addresses: unknown) => {
        if (error) return req.emit("error", error);
        expect(addresses).toEqual([{ address: "8.8.8.8", family: 4 }]);
        expect(opts.headers["accept-encoding"]).toBe("identity");
        const res = new EventEmitter() as any;
        res.headers = { "content-type": "text/html" };
        res.statusCode = 200;
        callback(res);
        res.emit("data", Buffer.from(html));
        res.emit("end");
      });
    return req;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.dns.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
});

it("reads the audited homepage size through the guarded transport and discovers its release", async () => {
  transport(2_580_000);
  const result = await createSourceReader()(westpac);
  expect(result.error).toBeNull();
  expect(result.items).toMatchObject([{ title, isoDate: null, discovery: "publisher-index" }]);
  expect(mocks.dns).toHaveBeenCalledOnce();
});

it("still rejects a Westpac homepage exceeding its bounded 4 MiB allowance", async () => {
  transport(4 * 1024 * 1024);
  expect((await createSourceReader()(westpac)).error).toBe(
    "Publisher index response exceeds byte limit"
  );
});

it.each([
  "https://www.westpaciq.com.au/economics",
  "https://example.org/",
  "https://www.westpaciq.com.au/?view=all",
])("keeps the 2 MiB limit on other routes: %s", async (url) => {
  transport(2_580_000);
  expect((await createSourceReader()({ ...westpac, url })).error).toBe(
    "Publisher index response exceeds byte limit"
  );
});

it("does not relax destination validation for the larger homepage", async () => {
  transport(2_580_000);
  mocks.dns.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
  const result = await createSourceReader()(westpac);
  expect(result.items).toEqual([]);
  expect(result.error).toBe("Publisher index destination rejected by outbound safety check");
});
