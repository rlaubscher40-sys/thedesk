/**
 * Resolve Google News redirect links to the real publisher URL.
 *
 * Most of the daily feed's topic queries come from Google News RSS, whose
 * item links point at `news.google.com/rss/articles/<id>` rather than the
 * masthead. Fetching that redirect for an og:image lands on Google's JS
 * interstitial — no image, no article body — so every Google-News-sourced
 * story fell back to the category watermark plate and "Read original" sent
 * the reader to Google rather than the publisher.
 *
 * Resolving to the publisher URL fixes both: the card gets a real photo and
 * the outbound link goes where the reader expects.
 *
 * Two strategies, cheapest first:
 *   1. Offline base64 decode of the article id. Works for the older link
 *      format whose payload embeds the destination URL verbatim. No network.
 *   2. The `batchexecute` RPC Google itself uses to expand a link. Needed for
 *      the newer signed format. One page fetch (for the signature/timestamp)
 *      plus one POST.
 *
 * Every path is wrapped so a failure or timeout returns the original URL —
 * the caller is then no worse off than before (watermark fallback), never
 * broken.
 */

const GNEWS_HOSTS = new Set(["news.google.com", "www.news.google.com"]);

/** True when the URL is a Google News redirect we should try to expand. */
export function isGoogleNewsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return GNEWS_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Pull the opaque article id out of a Google News link. Handles the RSS
 * (`/rss/articles/<id>`), web (`/articles/<id>`) and newer (`/read/<id>`)
 * shapes. Returns null for anything else.
 */
export function gnewsArticleId(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const m = pathname.match(/\/(?:rss\/)?(?:articles|read)\/([^/?#]+)/);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

/** A http(s) URL that isn't itself a Google property. */
function isUsablePublisherUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (!/^https?:$/i.test(new URL(url).protocol)) return false;
    return !/(?:^|\.)(?:google|gstatic|googleusercontent|youtube)\.com$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Decode the destination URL straight out of the article id, no network.
 * The id is urlsafe base64 of a small protobuf-ish blob; for the older
 * format the destination sits inside it as a printable run, so we decode to
 * bytes and lift the first publisher URL out. Returns null when the id is the
 * newer signed format (no embedded URL) or anything looks off.
 */
export function decodeGoogleNewsUrlOffline(articleId: string): string | null {
  try {
    // urlsafe base64 → standard, pad to a multiple of 4.
    let b64 = articleId.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length === 0) return null;
    const blob = bytes.toString("latin1");
    // Newer signed payloads are prefixed with the marker "AU_yqL"; they carry
    // no inline URL, so don't waste a regex pass — signal "try the network".
    if (blob.startsWith("\x08") && blob.includes("AU_yqL")) return null;
    const matches = blob.match(/https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g);
    if (!matches) return null;
    for (const candidate of matches) {
      // Trim a stray trailing protobuf field-length byte that can ride along
      // as a percent-less punctuation tail.
      const cleaned = candidate.replace(/[\x00-\x1F].*$/, "");
      if (isUsablePublisherUrl(cleaned)) return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

const BATCHEXECUTE_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

/**
 * Expand a signed Google News link via the same RPC the page uses. Fetches
 * the article page for its signature + timestamp, then asks batchexecute for
 * the destination. Returns null on any failure.
 */
export async function decodeGoogleNewsUrlOnline(
  url: string,
  timeoutMs = 6_000
): Promise<string | null> {
  const articleId = gnewsArticleId(url);
  if (!articleId) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    };

    // 1. Fetch the article page for the per-link signature + timestamp.
    const page = await fetch(`https://news.google.com/rss/articles/${articleId}`, {
      signal: controller.signal,
      redirect: "follow",
      headers,
    });
    if (!page.ok) {
      clearTimeout(timer);
      return null;
    }
    const html = await page.text();
    const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    const innerId = html.match(/data-n-a-id="([^"]+)"/)?.[1] ?? articleId;
    if (!sig || !ts) {
      clearTimeout(timer);
      return null;
    }

    // 2. Ask batchexecute to expand the link.
    const payload = [
      [
        [
          "Fbv4je",
          `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${innerId}",${ts},"${sig}"]`,
        ],
      ],
    ];
    const body = new URLSearchParams({ "f.req": JSON.stringify(payload) });
    const res = await fetch(BATCHEXECUTE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return parseBatchExecuteUrl(text);
  } catch {
    return null;
  }
}

/**
 * Lift the destination URL out of a batchexecute response. The body is
 * Google's anti-JSON-hijack format (`)]}'` preamble, then chunked length-
 * prefixed JSON lines); the line we want carries "garturlres" and a nested
 * JSON string whose second element is the URL. Exported for unit testing.
 */
export function parseBatchExecuteUrl(responseText: string): string | null {
  try {
    const line = responseText.split("\n").find((l) => l.includes("garturlres"));
    if (!line) return null;
    const outer = JSON.parse(line) as unknown;
    // outer is [[ "wrb.fr", "Fbv4je", "<inner json string>", ... ]]
    const innerJson = findInnerGarturl(outer);
    if (!innerJson) return null;
    const inner = JSON.parse(innerJson) as unknown;
    // inner === ["garturlres", "<url>", ...]
    if (Array.isArray(inner) && typeof inner[1] === "string") {
      return isUsablePublisherUrl(inner[1]) ? inner[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Walk the decoded outer array for the nested JSON string holding the URL. */
function findInnerGarturl(node: unknown): string | null {
  if (typeof node === "string") {
    return node.includes("garturlres") ? node : null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findInnerGarturl(child);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Resolve a possibly-Google-News URL to the publisher URL. Non-Google links
 * pass straight through. On any decode failure the original URL is returned,
 * so the caller's behaviour degrades to exactly what it was before.
 */
export async function resolveArticleUrl(
  url: string | null,
  { timeoutMs = 6_000 }: { timeoutMs?: number } = {}
): Promise<string | null> {
  if (!url || !isGoogleNewsUrl(url)) return url;
  const id = gnewsArticleId(url);
  if (id) {
    const offline = decodeGoogleNewsUrlOffline(id);
    if (offline) return offline;
  }
  const online = await decodeGoogleNewsUrlOnline(url, timeoutMs);
  return online ?? url;
}
