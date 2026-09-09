/** Bounded outbound HTTP with DNS validation at the actual socket lookup. */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
const blocked = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, bits, "ipv4");
const v6Public = new BlockList();
v6Public.addSubnet("2000::", 3, "ipv6");
for (const [ip, bits] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(ip, bits, "ipv6");
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, "ipv4")
    : family === 6 && v6Public.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export function validatePublicUrl(raw: string | URL): URL {
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== (url.protocol === "https:" ? "443" : "80"))
  )
    throw new Error("Unsafe outbound URL");
  if (isIP(host) && !isPublicAddress(host)) throw new Error("Non-public outbound address");
  return url;
}
export async function resolvePublicHost(host: string) {
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Non-public outbound DNS answer");
  return addresses;
}
export async function publicFetch(
  raw: string | URL,
  init: RequestInit & { maxBytes?: number } = {}
): Promise<Response> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(10000),
    ...(init.signal ? [init.signal] : []),
  ]);
  const maxBytes = init.maxBytes ?? 1024 * 1024;
  let url = validatePublicUrl(raw);
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) throw new Error("Unsupported outbound method");
  for (let hop = 0; hop <= 5; hop++) {
    signal.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("accept-encoding", "identity");
    headers.delete("host");
    headers.delete("authorization");
    headers.delete("cookie");
    const response = await new Promise<{ status: number; headers: Headers; bytes: Buffer }>(
      (resolve, reject) => {
        const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
          url,
          {
            method,
            headers: Object.fromEntries(headers),
            signal,
            agent: false,
            lookup(host, options, callback) {
              void resolvePublicHost(host)
                .then((addresses) => {
                  // Return only these validated addresses; the HTTP client cannot perform a second DNS resolution.
                  if (options.all) callback(null, addresses);
                  else {
                    const selected =
                      addresses.find((a) => !options.family || a.family === options.family) ??
                      addresses[0]!;
                    callback(null, selected.address, selected.family);
                  }
                })
                .catch((error) => callback(error, []));
            },
          },
          (res) => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value !== undefined)
                responseHeaders.set(key, Array.isArray(value) ? value.join(",") : value);
            }
            const chunks: Buffer[] = [];
            let size = 0;
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > maxBytes) {
                const error = new Error("Outbound response too large");
                reject(error);
                req.destroy(error);
                return;
              }
              chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("end", () =>
              resolve({
                status: res.statusCode ?? 502,
                headers: responseHeaders,
                bytes: Buffer.concat(chunks),
              })
            );
          }
        );
        req.on("error", reject);
        if (init.body !== undefined && init.body !== null) {
          if (typeof init.body !== "string")
            return req.destroy(new Error("Unsupported outbound body"));
          req.write(init.body);
        }
        req.end();
      }
    );
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has("location")) {
      if (hop === 5) throw new Error("Too many outbound redirects");
      // Credentials never follow a redirect; preserve only GET to avoid replaying RPC bodies.
      if (method !== "GET") throw new Error("Outbound POST redirect denied");
      url = validatePublicUrl(new URL(response.headers.get("location")!, url));
      continue;
    }
    const encoding = response.headers.get("content-encoding");
    let bytes = response.bytes;
    const options = { maxOutputLength: maxBytes };
    if (encoding === "gzip") bytes = gunzipSync(bytes, options);
    else if (encoding === "deflate") bytes = inflateSync(bytes, options);
    else if (encoding === "br") bytes = brotliDecompressSync(bytes, options);
    else if (encoding && encoding !== "identity") throw new Error("Unsupported outbound encoding");
    response.headers.delete("content-encoding");
    response.headers.delete("content-length");
    return new Response([204, 205, 304].includes(response.status) ? null : new Uint8Array(bytes), {
      status: response.status,
      headers: response.headers,
    });
  }
  throw new Error("Outbound redirect limit");
}
