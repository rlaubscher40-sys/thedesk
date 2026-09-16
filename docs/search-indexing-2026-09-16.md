# Search indexing remediation, 16 September 2026

Inspected the authenticated Search Console domain property for thedesk.au. The Pages report (last update 14 September) showed 27 indexed URLs and 11 exclusions across six categories. Counts overlap in the example lists and reflect historical crawls.

| Category | Actual examples | Finding / action |
| --- | --- | --- |
| 404 | `https://www.thedesk.au/` | Google live test on 16 September now fails with **Invalid server SSL certificate**. Railway lists both apex and www on port 8080; the connected domain tools cannot inspect certificate issuance or DNS verification status. Still unresolved; needs DNS/certificate inspection through the account owner or Cloudflare connection. Do not remove/recreate the domain or weaken TLS. |
| noindex | `/install` | Intentional utility-page exclusion; retained. |
| Alternative canonical | `/archive?q={search_term_string}` | Literal retired SearchAction placeholder. Remove the discovery source and permanently redirect that exact placeholder to `/archive`. Normal search filters remain functional and canonicalise to `/archive`. |
| Page with redirect | HTTP homepage; same search placeholder | HTTPS canonical redirect is intentional. Do not request indexing for redirect origins or remove HTTPS redirection to clear the report. |
| Crawled, not indexed | `/social`; `/signals?metric=brisbane_approvals_12m`; `/markets?q=Perth&rentPeriod=2026-07`; `/markets/compare/brisbane-vs-perth`; `/feed.xml` | Social needs its own metadata, visible source content and sitemap discovery. Signals need visible dated evidence and consistent canonicals after JS. Filtered markets consolidate to `/markets`. Comparison pilot deliberately remains noindex pending fuller coverage. RSS remains available with an explicit noindex header. Google decides whether eligible pages are indexed. |
| Robots blocked | `/login` (18 August crawl) | Current wildcard robots policy permits fetching login; login is intentionally noindex. Existing validation already in progress; not restarted. |

## Code changes

- Give all editorial sitemap landing pages individual server-rendered titles, descriptions and canonicals. Fallback public routes also receive their own canonical instead of inheriting the homepage.
- Render the shared documentary sources component on `/social` before JavaScript, including the same source credits and limitations as the client page.
- Render the selected signal's dated value/context/source in initial HTML, including saved snapshots. Preserve the server's validated canonical during initial client startup; preserve content-identifying parameters on subsequent navigation.
- Include `/social` and `/subscribe` in the editorial sitemap; return a non-cacheable 503 rather than a truncated successful sitemap when its database query fails.
- Remove the literal SearchAction template and redirect that exact historical search query; preserve ordinary searches.
- Keep private/utility noindex rules and real 404s intact.

## Search Console actions

The product sitemap was missing from submitted sitemaps. Submitted `https://thedesk.au/product-sitemap.xml`; Google returned **Success**, last read 16 September, **12 discovered pages**. The editorial sitemap previously showed a June 14 last read and 13 discovered pages. Refresh it after the code is deployed, then request indexing of the improved public pages. Do not restart broad validation for intentional exclusions or claim the www issue is fixed before Google can fetch its valid HTTPS redirect.

## End-of-turn checkpoint

- Local implementation commit: `c861201`, branch `fix/search-indexing`, based on main `6124f1e` (PR #298).
- 87 targeted tests passed across eight suites; TypeScript, dead-code audit, client build and server bundle passed.
- Automatic approval review rejected the GitHub push, stating that explicit authorisation to publish/push the repository is required. No remote PR, merge or deployment was performed. Request explicit push/merge/deploy authorisation; do not route around the rejection via another publishing mechanism.
- Resubmitted the existing editorial sitemap in Search Console. Google confirmed successful submission on 16 September; its displayed last-read date remained 14 June and discovered count 13 immediately afterward. This is a recrawl request, not proof Google fetched the updated sitemap, and the code additions are not live yet.
- Cloudflare was offered for connection but is not confirmed connected. Its DNS/certificate work remains blocked. Google live test independently confirmed the invalid www SSL certificate; do not claim the 404 category is fixed.

## Publication authorised

The user explicitly authorised **Push and merge** in the follow-up. Rebased the isolated indexing branch onto main `d88d04d` (PR #299) before publication. Recheck CI against the final branch head and verify the resulting Railway deployment after merge. The independent www certificate limitation is unchanged.
