import { parse } from "parse5";
import { LOCAL_SOURCES, type LocalSourceKey, type LocalDataset } from "../../shared/localData";

type Validators = NonNullable<LocalDataset["downloadCache"]>;
const validEtag = (value: string | null | undefined) =>
  value && value.length <= 512 && /^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
    ? value
    : undefined;
const validModified = (value: string | null | undefined) =>
  value &&
  value.length <= 128 &&
  !/[\x00-\x1f\x7f]/.test(value) &&
  Number.isFinite(Date.parse(value))
    ? value
    : undefined;

export async function fetchSource(
  url: string,
  source: LocalSourceKey,
  limit: number,
  signal?: AbortSignal
): Promise<Buffer> {
  const result = await fetchSourceResponse(url, source, limit, signal);
  if (result.status !== "downloaded") throw new Error("Unexpected unchanged response");
  return result.bytes;
}

export async function fetchSourceResponse(
  url: string,
  source: LocalSourceKey,
  limit: number,
  signal?: AbortSignal,
  validators?: Validators
): Promise<
  | { status: "unchanged" }
  | { status: "downloaded"; bytes: Buffer; finalUrl: string; etag?: string; lastModified?: string }
> {
  const controller = AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]);
  let target = new URL(url);
  for (let redirects = 0; redirects <= 3; redirects++) {
    target.hash = "";
    if (
      target.protocol !== "https:" ||
      !sourceHostAllowed(target, source) ||
      target.username ||
      target.password ||
      (target.port && target.port !== "443")
    )
      throw new Error("Source URL is outside the registered publisher");
    // Validators belong to the exact representation, never another redirect target.
    const exact = validators?.resourceUrl === url && validators.finalUrl === target.href;
    const etag = exact ? validEtag(validators.etag) : undefined;
    const modified = exact && !etag ? validModified(validators.lastModified) : undefined;
    const response = await fetch(target, {
      signal: controller,
      redirect: "manual",
      headers: {
        Accept: "text/html, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "User-Agent": "TheDesk/1.0 (+https://thedesk.au)",
        ...(etag ? { "If-None-Match": etag } : {}),
        ...(modified ? { "If-Modified-Since": modified } : {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid source redirect");
      target = new URL(location, target);
      continue;
    }
    if (response.status === 304) {
      await response.body?.cancel();
      if (!etag && !modified)
        throw new Error("Publisher returned unchanged without a matching cached validator");
      return { status: "unchanged" };
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      // Host only: do not log query strings, credentials or arbitrary paths.
      throw new Error(`Publisher HTTP ${response.status} (${target.hostname})`);
    }
    if (Number(response.headers.get("content-length")) > limit) {
      await response.body?.cancel();
      throw new Error("Source exceeds download limit");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty source response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new Error("Source exceeds download limit");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return {
      status: "downloaded",
      bytes: Buffer.concat(chunks),
      finalUrl: target.href,
      etag: validEtag(response.headers.get("etag")),
      lastModified: validModified(response.headers.get("last-modified")),
    };
  }
  throw new Error("Too many source redirects");
}

export function sourceHostAllowed(url: URL, source: LocalSourceKey): boolean {
  if (url.hostname === new URL(LOCAL_SOURCES[source].url).hostname) return true;
  return (
    source === "wa-bond-rents" &&
    url.hostname === "ahdap-public-data.s3.ap-southeast-2.amazonaws.com" &&
    url.pathname.startsWith("/RentalBondsWA/")
  );
}

export function sourceLinks(html: string, base: string, source?: LocalSourceKey): string[] {
  const links: string[] = [];
  const walk = (node: ReturnType<typeof parse> | any) => {
    if (node.tagName === "a") {
      const href = node.attrs?.find((a: { name: string }) => a.name === "href")?.value;
      if (href) {
        try {
          const url = new URL(href, base);
          if (url.origin === new URL(base).origin || (source && sourceHostAllowed(url, source)))
            links.push(url.href);
        } catch {}
      }
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(html));
  return [...new Set(links)];
}
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function selectResource(
  source: LocalSourceKey,
  html: string,
  now: Date
): { url: string; period: string } {
  const links = sourceLinks(html, LOCAL_SOURCES[source].url);
  if (source === "qld-bond-rents") {
    const matches = links.filter((url) => /\/rta-bond-statistics\.xlsx$/.test(url));
    if (matches.length !== 1) throw new Error("Queensland workbook link changed");
    return { url: matches[0]!, period: "" };
  }
  if (source === "abs-sa2-population") {
    // A new geography edition needs an explicit parser review, not a silent relabel.
    if (
      !/Geographic areas[\s\S]{0,4000}Australian Statistical Geography Standard \(ASGS\) Edition 3/.test(
        html
      )
    )
      throw new Error("ABS population boundary edition needs review");
    const candidates = links
      .flatMap((url) => {
        const match = url.match(/\/32180DS0001_(\d{4})-(\d{2})\.xlsx$/i);
        if (!match) return [];
        const year = Number(match[1]) + 1;
        if (String(year).slice(-2) !== match[2] || year > now.getUTCFullYear()) return [];
        return [{ url, period: `${year}-06-30` }];
      })
      .sort((a, b) => b.period.localeCompare(a.period));
    if (!candidates[0]) throw new Error("ABS local population workbook link changed");
    return candidates[0];
  }
  const candidates = links
    .flatMap((url) => {
      const match = url.match(/\/rentalbond_lodgements_([a-z]+)_(\d{4})\.xlsx$/i);
      if (!match) return [];
      const month = MONTHS.indexOf(match[1]!.toLowerCase()) + 1;
      if (!month) return [];
      const period = `${match[2]}-${String(month).padStart(2, "0")}`;
      if (period >= now.toISOString().slice(0, 7)) return [];
      return [{ url, period }];
    })
    .sort((a, b) => b.period.localeCompare(a.period));
  if (!candidates[0]) throw new Error("NSW monthly bond workbook link changed");
  return candidates[0];
}
