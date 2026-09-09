import { beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.dns }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { isPublicAddress, validatePublicUrl, resolvePublicHost, publicFetch } from "./publicFetch";
beforeEach(() => vi.resetAllMocks());
it.each([
  "127.0.0.1",
  "10.0.0.1",
  "169.254.169.254",
  "192.168.1.1",
  "172.16.0.1",
  "100.64.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fe80::1",
  "2002:7f00:1::1",
])("blocks non-public address %s", (address) => expect(isPublicAddress(address)).toBe(false));
it.each([
  "http://2130706433",
  "http://0x7f000001",
  "http://0177.0.0.1",
  "http://127.1",
  "http://[::1]",
  "https://example.com:8443",
  "https://user:pass@example.com",
  "file:///etc/passwd",
])("rejects unsafe URL %s", (url) => expect(() => validatePublicUrl(url)).toThrow());
it("allows ordinary public IPv4 and IPv6 destinations", () => {
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  expect(isPublicAddress("2606:4700::1111")).toBe(true);
  expect(validatePublicUrl("https://www.abs.gov.au/").hostname).toBe("www.abs.gov.au");
});
it("rejects mixed public/private DNS answers", async () => {
  mocks.dns.mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  await expect(resolvePublicHost("example.org")).rejects.toThrow("Non-public");
});
function transport(status: number, headers: Record<string, string>, body: string) {
  mocks.request.mockImplementation((url, opts, callback) => {
    const req = new EventEmitter() as any;
    req.write = vi.fn();
    req.destroy = (error: Error) => {
      queueMicrotask(() => req.emit("error", error));
      return req;
    };
    req.end = () =>
      opts.lookup(url.hostname, { all: true }, (error: Error | null, addresses: any) => {
        if (error) return req.emit("error", error);
        expect(addresses).toEqual([{ address: "8.8.8.8", family: 4 }]);
        const res = new EventEmitter() as any;
        res.headers = headers;
        res.statusCode = status;
        callback(res);
        res.emit("data", Buffer.from(body));
        res.emit("end");
      });
    return req;
  });
  mocks.dns.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
}
it("pins validated DNS answers to the connection and returns bounded public content", async () => {
  transport(200, { "content-type": "text/html" }, "hello");
  expect(await (await publicFetch("https://example.org")).text()).toBe("hello");
  expect(mocks.dns).toHaveBeenCalledTimes(1);
});
it("rejects redirects to private destinations before opening another connection", async () => {
  transport(302, { location: "http://127.0.0.1/internal" }, "");
  await expect(publicFetch("https://example.org")).rejects.toThrow("Non-public");
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
it("rechecks DNS on a redirected host", async () => {
  transport(302, { location: "https://next.example.org/" }, "");
  mocks.dns
    .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
    .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
  await expect(publicFetch("https://example.org")).rejects.toThrow("Non-public");
  expect(mocks.dns).toHaveBeenCalledTimes(2);
});
it("refuses oversized body data", async () => {
  transport(200, {}, "x".repeat(100));
  await expect(publicFetch("https://example.org", { maxBytes: 10 })).rejects.toThrow("too large");
});
