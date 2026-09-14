# Advice coverage source replacement, 14 September 2026

Professional Planner's repeated production article denials now have an explicit
operational pause. Its direct discovery entry is removed. Direct candidates,
resolved Google News candidates and standalone article reads stop before an
article request. The recorded reason is `article-source-paused`; the pause
survives restarts through checked-in configuration. Historical stories and
publisher attribution are preserved. Resuming requires a reviewed approved
access route, not a retry timer or changed identity.

## Replacement and verified access

- ASIC Media Releases and Financial Advice Association Australia remain active.
  Official releases retain higher ranking weight than association commentary.
- Money Management is added as specialist reporting through
  <https://www.moneymanagement.com.au/feed/>. Its feed returned 10 items;
  three sampled article pages returned HTTP 200. Its published robots file
  permits this route. No paid services were added.
- The sampled adviser-ban report at
  <https://www.moneymanagement.com.au/art-reviews-banning-of-two-former-advisers/>
  yielded 4,815 characters from its declared post body and an original timestamp
  of 2026-09-13T20:30:02Z (14 September in Sydney). It passes a captured-page
  replay into AU/POLICY under Money Management's own attribution. This replay
  only includes the sampled article body; it does not prove a production match
  or complete competitive coverage.
- IFA's feed and news index returned access denials. Financial Standard's
  tested RSS route also returned a denial. Neither is added.
- Financial Newswire's sampled pages and feed returned 200, but its robots file
  disallows its RSS route. It is not configured. A successful HTTP response
  alone is not enough to approve ongoing ingestion.

## Article integrity

Money Management's actual body is `.entry-content`; the generic semantic
article fallback selects related story cards instead. The adapter now requires
that explicit body and excludes the preferred-source promotional paragraph.
Comments and related cards outside the body are not evidence. The current
article's JSON-LD `articleSection` disclosure holds promoted/sponsored material;
unrelated advertisement metadata does not hold a legitimate news article.

The publisher emits a second JSON-LD publication timestamp in the form
`YYYY-MM-DD HH:mm:ssAustralia/Melbourne`. The parser resolves that explicitly
named timezone, including daylight saving, and checks agreement with its ISO
publication declaration. Ambiguous/nonexistent times stay invalid; conflicting
publication days stay conflicting. No URL date or collection clock becomes
publication evidence, and other publishers' parsing is unchanged.

The existing pipeline can select an accessible original release or alternative
report of the event, using its own text, URL and publication date. The blocked
article contributes no content or corroboration. Ordinary duplicate, freshness,
relevance and final publication checks still run. This is coverage redundancy,
not automatic web-wide searching for arbitrary blocked headlines.

## Rollout and verification

One durable collection claim (`advice-source-replacement-recovery`, one attempt)
reads only ASIC, FAAA and Money Management after deployment. Routine collection
continues on the existing schedule. There are no additional social-post jobs.
Verify deployment and this collection's source/article outcomes in production;
verify saved story rows separately from selection and insertion counts.

Regression checks cover direct/resolved publisher pauses without requests,
alternative-source attribution without false corroboration, extraction boundary,
sponsored metadata, timezone/DST/calendar failures, and recovery claim limits.

## Production result and permitted newsroom follow-up

PR #277 passed all 2,378 CI tests and deployed as 676fb62. Railway's actual
Money Management RSS request returned 403. Its successful workstation fetch
was not sufficient proof of production access. ASIC's recovery read succeeded
and inserted one report; the adviser-ban event was already published from ASIC.
The Money Management topic index also returned 403 during the subsequent check.
Its direct RSS entry is removed; its reviewed article adapter remains available
for ordinarily accessible rediscovered articles, without retrying denied URLs.

Financial Newswire's public /financial-planning/ index returned HTTP 200 and
its robots file permits that path and article pages. The previously checked
article pages also returned 200. This route uses the rendered headline
containers (rpsw-post-title or post-header), excludes sidebar/comment links
and other subject paths, and never requests its disallowed RSS feed. The
article reader requires content-inner, and checks sponsorship inside that
article body plus the current article's own structured disclosure. Comments
outside the body do not become evidence. Standard dates, evidence, geography,
ranking and duplication remain mandatory.

A separate one-attempt durable recovery reads only this newsroom after the
follow-up deploy. Production access must still be verified from that run.
Workstation access and synthetic regression checks alone do not establish it.
