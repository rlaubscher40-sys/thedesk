// Bump this whenever the caching strategy changes so `activate` purges
// older caches. v1 served the navigation shell cache-first and never
// refreshed it, which pinned browsers to a stale index.html — that old
// HTML kept requesting content-hashed chunks (e.g. Editions-*.js) that
// later deploys had already removed, producing "Failed to fetch
// dynamically imported module" on routes like /editions.
const CACHE = "thedesk-shell-v2";

// Static assets that form the app shell — cached on install for offline.
const SHELL = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API, tRPC, OAuth or cross-origin requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Navigation requests: NETWORK-FIRST. The HTML shell links the current,
  // content-hashed JS/CSS chunks, so it must always reflect the deployed
  // build — serving a stale cached copy makes the browser ask for chunk
  // filenames a later deploy has already deleted. Fetch fresh, refresh
  // the cached fallback, and fall back to cache only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", clone));
          return response;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached ?? caches.match(request))
        )
    );
    return;
  }

  // Static assets: cache-first. Vite content-hashes these filenames, so
  // they're immutable — a new build ships new names rather than mutating
  // existing ones, meaning cache-first can never serve stale code here.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
