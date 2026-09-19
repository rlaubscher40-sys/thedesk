# Mobile loading and network access follow-up

## 19 September 2026: same-tab recovery

The reader reached the app's module-download error screen. Its Reload button
returned to the same screen; closing the tab and opening a new one worked.
Five homepage module failures were recorded around the report. Separately, an
older admin tab requested a retired Login chunk (404), while current bundles
returned 200. This supports a stale-tab recovery problem but does not identify
the exact resource that failed on the reader's iPhone.

Recovery now replaces the document with a unique `_desk_reload` URL, preserving
the path, existing filters and fragment. On startup the marker is removed with
`history.replaceState`. Before navigation, cache deletion and unregistering only
The Desk's `/sw.js` run independently under the existing 1.5-second deadline.
Cookies, saved stories, preferences and the five-minute automatic-retry guard
are retained. Manual recovery works even inside that cooldown or with blocked
storage. The bundle-independent splash retry also uses a fresh document URL.

Service worker v6 requests navigation HTML with `cache: no-store`. Missing
deployment assets return a non-cacheable plain-text 404 instead of an HTML app
shell. Valid hashed bundles retain immutable caching.

Regression coverage includes repeated manual retries, automatic-loop prevention,
blocked and hanging storage/worker APIs, cleanup scope, URL/state preservation,
bundle-independent retry, navigation fetch policy and retired asset responses.
Browser verification in Chrome is not a reproduction on the reader's iPhone.

12 September 2026. Base: 0d7ca5b88c021f694813c5b2e7465678e2bac5bb.

## Evidence and limits

- Ruben can reach https://thedesk.au on mobile data but cannot finish navigating from Google on Spanish hotel Wi-Fi. This isolates a network-dependent symptom; it does not prove the hotel's filtering is the cause.
- A separate historical report shows iPhone Safari's “A problem repeatedly occurred” on the homepage and /story/1440001 while on 5G. A follow-up reported refresh crashes in incognito too. This is a browser-process failure symptom, distinct from the hotel navigation stall. The screenshots show the previous dark design, dated 22 June, so they do not establish that the current build still reproduces it.
- Current Railway deployment was healthy; live homepage, script and stylesheet requests returned 200. The homepage, reported story and Trends rendered in the available Chrome browser. This is not an iOS/WebKit reproduction test.
- Google's public resolver returned healthy A and AAAA answers for the apex and NXDOMAIN (status 3) for www.thedesk.au. Cloudflare nameservers are authoritative. No evidence of an apex DNS failure or a country block was established.

## Application changes

- Touch devices start in lightweight mode, without route transitions or the canvas/blurred decorative background. Recovery mode survives blocked localStorage for the current document. Existing reduced-motion behaviour remains.
- Preference reads/writes in theme, persona, feed, reading history, bookmarks, metrics, watchlists and iOS nudges cannot throw if storage is blocked or full.
- Route downloads have a 20-second deadline. Automatic chunk recovery requires a verified sessionStorage write, is limited across all routes to once per five minutes, and never leaves a permanent pending promise. Cache cleanup cannot hold reload for more than 1.5 seconds.
- Ordinary query requests bound both headers and body at 20 seconds, preserve cancellation, and retry once. Long-running mutations and the separate Ask deadline retain their existing policy.
- The HTML splash offers a manual retry after 15 seconds even if the main module never executes. Feed/story/trends show connection failures rather than silently disappearing or mislabelling a failed story request as a missing story. Caught React errors go to the existing internal error reporter.
- Service worker v4 does not cache navigation HTML. A 12-second navigation deadline leads to a small standalone retry page, without stale script dependencies. Script/style/font caches are capped at 64 entries, exclude media and range/query requests, and cannot block network responses when storage fails. Only The Desk's old caches are removed. Unhashed static files, including the worker, revalidate after deployments.

## Domain correction still pending

The existing canonical-host middleware already redirects www pages to the apex once requests reach the app. Railway previously had only the apex attached. This work attached www.thedesk.au on port 8080. Railway now requires:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | www | ea6dmfos.up.railway.app |

Railway returned VALIDATING_OWNERSHIP, REQUIRES_UPDATE. Cloudflare access was unavailable on the user's mobile device. The DNS write, certificate issuance and live www redirect still require verification. Do not say www is fixed until they pass. Check Cloudflare traffic/security events against a fresh failed hotel request to investigate the separate apex/Wi-Fi symptom. Do not disable WAF rules or IPv6 speculatively.

## Validation and follow-up

Focused regression tests cover blocked/discarded storage, reload cooldown across routes, stalled imports/headers/bodies/cache APIs, touch/reduced-motion rendering policy, independent splash retry, offline worker responses, bounded caches and HTTP caching headers. Run the repository's full CI before merge.

After deployment, verify healthz, the changed worker and splash, then homepage/story/trends rendering and refresh. An actual iPhone retry by the affected reader is still needed to establish whether the historical process crash persists. The available browser is Chrome, not a real iPhone or WebKit runner.
