/** Fixed public publishers only. Bound redirects, body size and whole-request time. */
const HOSTS = new Set([
  "www.realestate.com.au",
  "www.westpaciq.com.au",
  "www.cotality.com",
  "e.infogram.com",
  "www.apra.gov.au",
  "www.commbank.com.au",
]);

/** Retry-After may be delta seconds or an HTTP date. Never retry sooner than
 * the publisher requests; absent/invalid values receive a one-hour backoff. */
export function publisherRetryAt(value: string | null, now = Date.now()): number {
  const raw = value?.trim() ?? "";
  const requested = /^\d+$/.test(raw) ? now + Number(raw) * 1000 : Date.parse(raw);
  return Number.isFinite(new Date(requested).getTime()) && requested > now
    ? requested
    : now + 3_600_000;
}

export class PublisherAccessDeniedError extends Error {
  constructor(public readonly status: number) {
    super(`Publisher HTTP ${status}; approved source access is required`);
    this.name = "PublisherAccessDeniedError";
  }
}

export class PublisherRateLimitError extends Error {
  constructor(public readonly retryAt: number) {
    super(`Publisher HTTP 429; requests paused until ${new Date(retryAt).toISOString()}`);
    this.name = "PublisherRateLimitError";
  }
}
export async function sourceBytes(rawUrl: string, maxBytes = 3_000_000): Promise<Buffer> {
  const signal = AbortSignal.timeout(25_000);
  let url = new URL(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (
      url.protocol !== "https:" ||
      !HOSTS.has(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      throw new Error("Unsupported metric publisher URL");
    const response = await fetch(url, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)",
        Accept: "text/html,application/pdf",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("Publisher redirect has no location");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        throw new PublisherAccessDeniedError(response.status);
      if (response.status === 429)
        throw new PublisherRateLimitError(publisherRetryAt(response.headers.get("retry-after")));
      throw new Error(`Publisher HTTP ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty publisher response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error("Publisher response too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many publisher redirects");
}
export async function sourceHtml(url: string) {
  return (await sourceBytes(url)).toString("utf8");
}

export { readableText as sourceText } from "./htmlText";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function sourceDate(day: string, month: string, year: string) {
  const m = MONTHS.findIndex((name) => name.toLowerCase() === month.slice(0, 3).toLowerCase());
  const date = new Date(Date.UTC(Number(year), m, Number(day)));
  if (m < 0 || date.getUTCDate() !== Number(day) || date.getUTCMonth() !== m)
    throw new Error("Invalid reporting date");
  return date.toISOString().slice(0, 10);
}
export function requireRecent(date: string, maxDays: number, now = new Date()) {
  const age = (now.getTime() - Date.parse(date)) / 86_400_000;
  if (!Number.isFinite(age) || age < 0 || age > maxDays)
    throw new Error(`Reporting period outside review window: ${date}`);
}
