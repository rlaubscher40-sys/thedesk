/**
 * Which SPA URLs are real pages, and which of them belong in the index.
 *
 * The client is a single bundle behind a catch-all, so historically every
 * URL — including typos, dead links and probe traffic — got a 200 and the
 * app shell. To a crawler that is a soft 404: a page that claims to exist,
 * renders no matching content, and lands in Search Console as "Crawled —
 * currently not indexed" while burning crawl budget that should have gone
 * to editions. Matching the path against the real route table lets an
 * unknown URL answer with an honest 404.
 *
 * The second list is the pages that exist but shouldn't be indexed — the
 * admin panel, login, the reader's own device-local surfaces, and the
 * one-shot links out of transactional email. These used to be handled with
 * `Disallow:` in robots.txt, which is the wrong tool: a blocked URL can
 * still be indexed from inbound links (Search Console calls it "Blocked by
 * robots.txt"), and because Google is forbidden from fetching it, it never
 * sees a request to drop it. Serving `noindex` on a crawlable page is what
 * actually removes it.
 *
 * ROUTES must mirror the <Route> table in client/src/App.tsx — a route
 * added there and forgotten here 404s in production while working in dev.
 */

import { publicMarket } from "../../shared/marketDirectory";

/** Exact-match public routes. */
const STATIC_ROUTES = new Set([
  "/",
  "/social",
  "/ask",
  "/subscribe",
  "/brief",
  "/signals",
  "/markets",
  "/markets/compare/brisbane-vs-perth",
  "/editions",
  "/queue",
  "/trends",
  "/topics",
  "/about",
  "/archive",
  "/admin",
  "/login",
  "/privacy",
  "/terms",
  "/editorial-standards",
  "/corrections",
  "/confirm-subscription",
  "/confirm",
  "/settings",
  "/install",
  // Normally unreachable: seo.ts 301s /search to /archive before the
  // catch-all sees it. Listed anyway so that if the redirect is ever
  // dropped, the route the client still ships falls back to its
  // client-side forward instead of a 404.
  "/search",
]);

/** Parameterised routes. One segment each, no nesting below them. */
const DYNAMIC_ROUTES = [
  /^\/evidence\/[1-9][0-9]*$/,
  /^\/editions\/[^/]+$/,
  /^\/topics\/[^/]+$/,
  /^\/story\/[^/]+$/,
];

/**
 * Real pages we don't want in search results: nothing here has content a
 * searcher could want, and several are per-reader or single-use.
 * Shared briefs are signed one-to-one snapshots, so they are intentionally
 * crawlable for link unfurling but noindex for search via distributionSeo.
 */
const NOINDEX_ROUTES = new Set([
  "/admin",
  "/login",
  "/settings",
  "/queue",
  "/install",
  "/confirm",
  "/confirm-subscription",
  "/search",
]);

export function isKnownRoute(pathname: string): boolean {
  if (STATIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/markets/"))
    return Boolean(publicMarket(pathname.slice("/markets/".length)));
  return DYNAMIC_ROUTES.some((re) => re.test(pathname));
}

export function isNoindexRoute(pathname: string): boolean {
  return NOINDEX_ROUTES.has(pathname) || /^\/evidence\/[1-9][0-9]*$/.test(pathname);
}

/**
 * `noindex, follow` — keep the page out of the index but let the crawler
 * keep walking the nav links on it, so the public pages it links to are
 * still discovered.
 */
const NOINDEX_TAG = `<meta name="robots" content="noindex, follow" />`;

/**
 * Add the robots meta to a shell that doesn't have one. Inserted right
 * after <head> so it's in the first bytes a crawler reads, well ahead of
 * any truncation point.
 */
export function withNoindex(html: string): string {
  if (/<meta\s+name="robots"/i.test(html)) return html;
  return html.replace(/<head>/i, `<head>\n    ${NOINDEX_TAG}`);
}
