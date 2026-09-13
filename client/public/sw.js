// v4 never caches navigation HTML. An old shell can reference deleted chunks,
// and an arbitrary page must not become another route's offline fallback.
const CACHE = "thedesk-static-v4";
const MAX_ENTRIES = 64;
const SHELL = ["/offline.html", "/manifest.json", "/favicon.svg", "/icon-192.png",
  "/icon-512.png", "/apple-touch-icon.png", "/fonts/SourceSans3-Variable.woff2",
  "/fonts/PlayfairDisplay-Variable.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try { await (await caches.open(CACHE)).addAll(SHELL); } catch { /* Optional cache. */ }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("thedesk-") && key !== CACHE).map((key) => caches.delete(key)));
    } catch { /* Storage failure must not prevent activation. */ }
    await self.clients.claim();
  })());
});

async function offlineResponse() {
  let timer;
  try {
    const html = await Promise.race([
      (async () => {
        const cached = await caches.match("/offline.html");
        return cached ? cached.text() : null;
      })(),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), 500); }),
    ]);
    if (html) return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch { /* Even without cache, return a useful response. */ }
  finally { clearTimeout(timer); }
  return new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>The Desk</title><h1>The Desk could not connect</h1><p>Check your connection, then <a href="">try again</a>.</p>', {
    status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function navigate(request) {
  const controller = new AbortController();
  let timer;
  try {
    const response = await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => { reject(new Error("Navigation timed out")); controller.abort(); }, 12000);
      }),
    ]);
    return response.status >= 500 ? offlineResponse() : response;
  } catch { return offlineResponse(); }
  finally { clearTimeout(timer); }
}

// Serialize writes/pruning so concurrent asset downloads cannot outrun the cap.
let writes = Promise.resolve();
function cacheAsset(request, response) {
  writes = writes.then(async () => {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
    const keys = await cache.keys();
    let excess = keys.length - MAX_ENTRIES;
    for (const key of keys) {
      if (excess <= 0) break;
      if (!SHELL.includes(new URL(key.url).pathname)) {
        await cache.delete(key);
        excess--;
      }
    }
  }).catch(() => {});
  return writes;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  // Cache only scripts/styles/fonts. Never retain videos, images, private pages,
  // range responses, or URLs with query parameters that can multiply entries.
  if (url.search || request.headers.has("range") ||
      !(/^\/assets\/[^/]+\.(js|css)$/.test(url.pathname) || /^\/fonts\/[^/]+\.woff2$/.test(url.pathname))) return;
  const response = (async () => {
    try {
      const cached = await caches.match(request);
      if (cached) return { response: cached };
    } catch { /* Network works even when CacheStorage does not. */ }
    const response = await fetch(request);
    const type = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length"));
    const cacheable = response.status === 200 && !response.redirected &&
      !/no-store|private/i.test(response.headers.get("cache-control") || "") &&
      /javascript|text\/css|font\/woff2/i.test(type) && length <= 2 * 1024 * 1024;
    return { response, copy: cacheable ? response.clone() : undefined };
  })();
  event.respondWith(response.then((result) => result.response));
  event.waitUntil(response.then((result) => result.copy ? cacheAsset(request, result.copy) : undefined).catch(() => {}));
});
