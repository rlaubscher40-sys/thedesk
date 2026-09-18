# Rent pressure monitor

The recurring question is: is annual rent growth easing across the eight Australian capitals? The first edition is `/analysis/rent-pressure`, published 18 September 2026 from the July 2026 ABS CPI Table 11 release (released 26 August). It is deliberately dated, not refreshed on every visit.

## Reproduce

Download the linked official `6401011.xlsx` source, then run:

```
pnpm analysis:rent-pressure /absolute/path/to/6401011.xlsx
```

The script compares the workbook SHA-256 with the preserved edition, invokes the existing isolated `abs-cpi` workbook parser and its pinned duplicate-series agreement gate, and recalculates city deltas, counts and spreads. A revised workbook is rejected for this edition, not silently substituted. The checked-in source observations and public download must remain identical.

Annual-rate deltas are percentage points between overlapping annual windows, not monthly changes in weekly rents. Equal city weights measure breadth, not the national rent index. No causal or investment inference is generated.

## Publish an update

1. Retrieve a new free ABS release and preserve its URL, actual release date, retrieval timestamp and workbook hash.
2. Use the existing parser, checking all eight cities and consecutive months. Missing, suppressed, duplicated, inconsistent or incomparable observations withhold the analysis.
3. Add a new immutable snapshot. Recalculate with `analyseRentPressure`; check each written finding against the returned result. Review chart scale and labels, including negative rates if present.
4. Update the page, public input download, metadata and dated history in the same PR. Retain older inputs and calculation versions in git. Any revision identifies which release it supersedes and why.
5. Run the parser/calculation/component checks, render the page, verify sources and narrow-screen readability, then use normal checked PR/deployment gates.

This is an editorial release workflow inside the existing publishing application, not a second cron or an automatic claim of freshness. No schedule or subscriber preference changes are made.
