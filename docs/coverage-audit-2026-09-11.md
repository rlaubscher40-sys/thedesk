# Coverage audit repair · 11 September 2026

The six-event list below is an assistant-reviewed provisional sample chosen before the original feed audit. It is neither human-approved nor comprehensive. The user subsequently asked to fix the findings. No admin must-cover review is submitted as Ruben's approval.

| Expected event | Original release/report | Audited publication |
| --- | --- | --- |
| Housing tax modelling | Australian, 10 Sep; [Master Builders joint release](https://masterbuilders.com.au/joint-statement-updated-modelling-housing-package-estimated-to-cut-10700-homes-and-push-rents-higher/), 11 Sep | PROPERTY 3840167; model horizon 2026–27 to 2029–30 |
| Queensland AA+ to AA downgrade | Australian, 11 Sep | PROPERTY 3870007 via MPA |
| Former Tweed Hospital consultation for 800 homes | [Daily Telegraph](https://www.dailytelegraph.com.au/news/nsw/tweed-heads/mp-justine-elliot-attacks-biggest-threat-to-superannuation-consultation-opens-for-800home-former-tweed-hospital/news-story/53a5a4995eb4f5cef184c3a56386c824), 11 Sep | No verified match; discovery history unknown |
| RentTech applicant privacy report | CPRC, 10 Sep; [Guardian](https://www.theguardian.com/australia-news/2026/sep/10/renttech-tenants-personal-information-privacy-victorian-laws), 10 Sep Sydney | AU 3840049; research November 2025–March 2026 |
| Australian shares fall on oil/yield/rate concerns | [Reuters](https://www.reuters.com/business/finance/australian-shares-slump-two-month-low-miners-fall-2026-09-11/), 11 Sep | AU 3870004 via ABC, partial; exact closing figures unverified in Desk record |
| Dwelling-stock value falls 0.3% | [ABS](https://www.abs.gov.au/media-centre/media-releases/value-dwellings-falls-03), **8 Sep** | AU 3840045, 10 Sep; June quarter 2026 |

## Changes

- General national-news liveblogs and sign-off summaries are held from local publication. “Housing nuclear activities” no longer supplies residential evidence. Numeric home-delivery announcements remain eligible for consideration.
- Professional Planner uses its permitted public newsroom, replacing the RSS endpoint returning 403. Public HTML replay found dated article links and extracted the 11 September tribunal report (publication 06:10:02 UTC, 5,981 characters). This verifies parsing, not successful Railway collection. All articles still pass original-date, disclosure, geography and content checks.
- Denials back off for six hours; 429 for one hour or a longer Retry-After; timeouts/other HTTP failures for one minute. Concurrent requests coalesce. Reports distinguish a denial/cooldown from empty results; repeated cooldowns do not produce repeated error logs. Cache is process-local and bounded; restarts reset cooldowns. No alternate authentication, user-agent evasion or denied-page bypass.
- Related publications link across AU/Property and within an ingest batch, using publisher dates, headline similarity and housing-model claims. Related is not independently corroborated, and records are retained. Links appear in the actual feed and story layouts.
- A bounded startup repair links existing related publications and clears generated angles with explicitly expired future deadlines, using old-value comparison. Existing thread choices and Ruben's notes are retained. The generic [MBA follow-up](https://masterbuilders.com.au/housing-supply-sliding-backwards-worsening-crisis/) explicitly cites the same 10,700-home model; its exact source URL/date relationship is recorded for the audited rows.
- Generation receives today's Sydney date and instructions separating publication dates, observation periods and forecast horizons. Generated and ingested angles reject explicit expired future deadlines and literal null placeholders. Numeric ranges/fiscal years retain a hyphen through voice cleanup.
- Northern Rivers discovery now includes Tweed, Lismore and Ballina, including a query without a mandatory state name. A dedicated Australian market-close query complements general ASX/rates discovery. These are discovery improvements, not publication evidence.

## Remaining verification

The permitted [Landcom consultation page](https://joinin.landcom.nsw.gov.au/tweed-heads/) confirms 12 September (Tweed Mall) and 13 September (Tweed Heads Market) sessions for around 800 homes, at least 10% affordable. It does not establish an original publication date. The [NSW acquisition announcement](https://www.nsw.gov.au/ministerial-releases/800-new-homes-for-former-tweed-hospital-site) is dated **20 July 2026** and must not be imported as fresh September news. No date is invented for the project page. Current project milestones also differ from the July announcement; do not merge their timelines silently.

Verify the next ordinary collection for a permitted, dated consultation report and an actual market-close publication. Never infer failed discovery from the absence of a saved record. The single Tasmania timeout is not evidence of repeated failure. No production imports, social sends, emails or admin reviews are part of this repair.
