# Victorian council rental release

The user supplied the official September-quarter 2025 LGA workbook on 10 September
2026 after normal publisher downloads failed. This release adds its reviewed
historical observations to local Markets, comparisons, Ask and Admin. It does not
establish current local rents or suburb data. The subsequent update path below separates catalogue availability from file-download success.

## Source and meaning

- [Official workbook](https://www.dffh.vic.gov.au/quarterly-median-rents-local-government-area-september-quarter-2025-excel)
- [Release and methodology](https://www.dffh.vic.gov.au/publications/rental-report)
- [Dataset-specific CC BY 4.0 notice](https://discover.data.vic.gov.au/dataset/rental-report-quarterly-quarterly-median-rents-by-lga)
- Supplied XLSX: 674,773 bytes; SHA-256 `b8e96347494f09fea2a2ace55997fd34c9398f8509cb3450d65444aebfaaa837`.
- Acquisition: user-supplied publisher workbook, received for review on 10 September
  2026. That receipt date is neither the observation period nor a verified successful
  publisher download.

Seven sheets publish council medians and counts: 1/2/3-bedroom flats,
2/3/4-bedroom houses, and All Properties. Headers contain paired Count/Median
columns for quarters from June 1999 to September 2025. The integration stores
the last five quarters, September 2024 through September 2025, for prior-year
comparisons without loading decades of history into every local-data read.
The original supplied file remains the source for earlier periods.

All 79 council names must occur exactly once on every sheet. The one abbreviated
publisher label `Mornington Penin'a` is displayed as Mornington Peninsula.
Other names remain as published. Boundaries are publisher-defined LGAs, not
suburbs or an independently verified ABS boundary edition. Melbourne LGA must
not be presented as metropolitan Melbourne. Explicit suburb/postcode questions
do not silently select council evidence.

Eighty-four aggregate rows across the seven sheets are excluded: region totals,
state totals, metro and non-metro rows. The report-page metropolitan headline
and the supplied workbook's metro summary differ, so neither is imported as a
city or state figure. We do not average council medians or sum overlapping
categories to reconstruct aggregates.

The source uses dashes for missing numerical figures, with no explanatory legend
in this workbook. They are stored as `source-unavailable`, separately from
confirmed suppression or a sample threshold. Missing figures remain null and
their reason is not guessed. Published small counts are retained with a caution
in the method text; counts are contextual and not asserted to be a verified
sample denominator. Blanks, text medians, footnotes and invalid count/value
pairs fail validation rather than silently becoming zero.

The release page describes quarterly medians from new rental lettings and notes
that its rent indices control for changing composition. These workbook medians
are not asking rents, vacancy, all-existing-tenancy rents or the rent index.

## Collection and source delivery

`scripts/import-vic-reviewed.mts` checks the original XLSX hash, uses the bounded
production workbook worker, validates the schema, and generates the compact
reviewed release. The VIC-specific worker profile permits 256 columns and 200
rows per sheet; ZIP, memory, deadline and cancellation limits remain in place.
Other source profiles retain their existing limits.

The `local-data-vic-reviewed-release` scheduler job uses the existing durable
lease and fenced snapshot writer. It imports only when no Victorian snapshot
exists, never overwrites a newer release, and never marks a publisher check as
successful. Failed writes remain retryable. No migration, external request,
email or model call is part of the import.

VIC is now included in the daily collector, using the specific DataVic CKAN
catalogue endpoint first. The catalogue identity and CC BY licence are checked,
and the latest completed quarterly LGA resource is selected from strict DFFH
URLs. The actual catalogue was retrieved successfully on 10 September 2026 and
still listed September 2025. An existing equal or newer snapshot prevents a
workbook download. This success means catalogue discovery succeeded, not that
the file endpoint is reachable or that the rents are current. Admin labels the
check accordingly. Same-quarter file corrections are not discovered by this
period-only check and require reviewed upload.

Only a newer listed quarter triggers a bounded download and the existing strict
VIC parser. A changed layout or failed request retains the last good snapshot
and records failure. VIC gets one scheduled attempt per day; publisher access
denials retain the existing pause policy. No browser workaround, paid proxy or
access-control bypass is used. Normal direct downloads returned HTTP 502 or
timed out during this review; successful future automatic file delivery remains
to be demonstrated when a new release is available.

Admin also supports original-file upload with an exact official workbook link.
Preview validates the complete workbook using the bounded worker and displays
quarter, councils and missing/published counts. Import requires the previewed
file hash and repeats validation. Server-side inputs are capped at 2 MB decoded;
only one upload parser runs at a time. The admin procedure retains existing
session and CSRF protections. No older release can replace a newer snapshot,
identical reviewed files are a no-op, storage failures remain visible, and an
upload never marks publisher health successful. Files remain attributed as
user-supplied, with receipt date separate from observation period. New quarterly
files fitting the validated schema no longer require a code change/deployment.

## Validation

The supplied workbook passed the production ZIP/worker/parser path. Output:
79 councils; 2,765 category-quarter observations; 2,297 published figures and
468 unavailable values over five quarters. September 2025 has 457 published
figures and 96 unavailable values.

Examples from the exact source cells: Mildura LGA three-bedroom houses,
September 2025: $490/week, reported count 210. Melbourne LGA two-bedroom flats:
$730/week, count 3,209. Queenscliffe three-bedroom houses are unavailable in the
latest quarter, while All Properties is published at $575/week with count five.

Regression tests cover real reduced source cells, changed schema and quarters,
missing/duplicate councils, unavailable values, category/geography guards,
historical citations, deterministic Ask answers, import fencing and disabled
automatic delivery. Production storage must be verified after deployment;
passing parser tests alone does not establish it.
