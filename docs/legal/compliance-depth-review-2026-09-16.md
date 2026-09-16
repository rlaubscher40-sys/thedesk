# Follow-through: rights, providers and accessibility

Review date: 16 September 2026. Base: main `6124f1e` (PR #298). This is an
engineering/evidence review, not legal clearance or WCAG certification.

## Implemented in this follow-up

- Trends edition bars and category treemap now have native, expandable data
  tables with captions and row/column headers. Small/truncated tiles remain
  readable; missing bar values say unavailable rather than inventing zero.
  Zero-area treemap inputs are excluded from layout but retained in the table.
- Bar axis labels use theme-aware text colours rather than a fixed colour.
- Chart entry animations no longer depend on permanent inline zero opacity:
  lite/reduced-motion users still see the bars and tiles when animations stop.
- Every production browser build emits `third-party-licenses.txt`, linked from
  Terms. Vite derives the list from actual bundled modules, including transitive
  packages. Two npm packages omit their licence text: exact-version fallbacks
  are recorded with upstream source/blob evidence. A new missing notice fails
  the build. This does not relicense Desk reporting or third-party datasets.
- `audit:legal` now walks installed runtime dependencies without running their
  code, records versions and top-level notice hashes, flags missing/reciprocal
  licences and embedded binary/WASM review, and records uninstalled optional
  packages. The local Linux inventory contains 243 package/version pairs, no
  missing required dependency, and 44 absent optional dependency edges. Counts
  can differ across supported platforms. This is not a complete binary SBOM.
- Local market observations now expose their configured source licence link.
  WA attribution retains the department/year specified on its dataset page.
- Voice notices identify the actual Fable default and permitted George/Daniel
  alternatives. Privacy distinguishes local speech from OpenAI image generation
  and names the verified Railway application-hosting location.

## Dataset and publisher assessment

No publisher restriction was lifted, collector newly enabled, historical content
removed or permission enquiry sent. A source URL alone does not grant rights.

| Actual source/use | Evidence checked | Disposition / next requirement |
| --- | --- | --- |
| ABS aggregate CPI/rents, approvals, population, labour and wages | [ABS copyright](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer), configured series in `shared/cityRents.ts`, `shared/cityApprovals.ts`, `shared/stateDemographicMetrics.ts`, and the ABS collectors | General CC BY 4.0 excludes microdata, branding and third-party material. Retain original source, reporting period, licence and notices of Desk calculations; this is not blanket approval of everything on an ABS domain. |
| RBA F1 daily cash-rate target and F6 housing rates | [RBA terms](https://www.rba.gov.au/copyright/) and `rbaCashRate.ts` / `rbaHousingRates.ts` | Cash-rate/financial-data provisions differ from the general text licence. Attribution includes RBA and year; no endorsement. F6 labels RBA/APRA, so underlying APRA terms also matter. Any future charge for covered data needs the free-source disclosure. Not cleared as a financial benchmark. |
| Victoria quarterly LGA rental workbook | [Exact DataVic catalogue entry](https://discover.data.vic.gov.au/dataset/rental-report-quarterly-quarterly-median-rents-by-lga) | Entry identifies Homes Victoria and CC BY 4.0. Existing release provenance and acquisition labels retained. Licence link now exposed beside observations. |
| WA monthly rental-bond records | [Exact dataset](https://housing-data-exchange.ahdap.org/dataset/west-australia-rental-bonds-data-2023-current) | Page explicitly specifies CC BY 4.0 and department/year attribution. Updated attribution; existing statement that medians are calculated by The Desk retained. No personal bond records are newly published. |
| NSW monthly rental-bond lodgements | [Data.NSW catalogue](https://data.nsw.gov.au/data/dataset/rental-bond-lodgement) | Dataset identity verified, but retrieved catalogue did not expose a licence grant. Keep item-level permission review open; do not substitute generic NSW website terms as evidence. |
| Queensland quarterly median rents | [Dataset page](https://www.rta.qld.gov.au/forms-resources/rta-data-releases/median-rents-quarterly-data) and [website copyright](https://www.rta.qld.gov.au/copyright) | Existing register cites workbook-specific CC BY 4.0. Website default is CC BY 3.0 AU with exclusions. Exact acquired workbook notice needs independent reconciliation; neither overwrite it with website defaults nor claim this check resolved it. |
| SA private rental report | [Configured catalogue](https://data.sa.gov.au/data/dataset/private-rent-report) | Catalogue retrieval returned 403 in this review. Existing attribution retained, not newly certified; retain/recheck the acquired release's notice. No bypass attempted. |
| Tasmania monthly bonds | Configured Department of Justice source and `LOCAL_SOURCES` | Current register asserts CC BY 4.0. Exact acquired dataset notice still needs verification; a generic CC licence URL is not proof of the publisher's grant. |
| Yahoo market quotes; Cotality HVI; Westpac–Melbourne Institute sentiment; CBA Group arrears | Active collectors identified in `dailyMetrics.ts` and `propertyReleases.ts` | Commercial automated collection, stored history, redistribution and downstream AI/social use remain item-specific review questions. Yahoo terms retrieval failed; no approval inferred. These are not covered by ABS/RBA licences. |
| News publishers | Existing `source-policy-reviews.json`, runtime source holds | ABC/Guardian extraction holds remain. Other working feeds are still unassessed, not implicitly approved. Historical/manual stories and social exports require a separate work-by-work review. |
| Auctions | `docs/published-market-metrics.md` | Owner's REA/PropTrack exclusion and collector pause remain. SQM permission is pending; public access is not permission. No new feed or paid service enabled. |

## Model, software and media findings

The [pinned Kokoro model card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/blob/1939ad2a8e416c0acfeecc08a694d14ef25f2231/README.md)
declares Apache-2.0. Existing model hashes and full Apache notice remain. The
stock voice selection is not evidence of training-data clearance or a blanket
guarantee about personality rights.

`phonemizer` 1.2.1 declares Apache-2.0 but embeds eSpeak NG. Its npm wrapper
notice does not resolve the embedded engine's [GPL obligations](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING).
The installed FFmpeg 7.0.2 Linux static build explicitly identifies GPL v3 in
`ffmpeg.README`; retain `ffmpeg.LICENSE`. [FFmpeg's own guidance](https://ffmpeg.org/legal.html)
distinguishes build options and redistribution obligations. Do not claim a
generic source link supplies the exact corresponding source.

Other flagged components include MPL-2.0 `satori`/`resvg` and LGPL libvips;
native ONNX and canvas components can contain additional notices. A metadata
flag is not a finding of infringement. Review actual deployment/distribution
and component boundaries before supplying a server image, downloadable renderer
or client-side voice package. Generated audio/video is not automatically the
same thing as distributing the generating software. No switch to paid voices,
removal of functionality or new software-distribution promise was made.

The dependency report deliberately preserves unknowns: for example,
`parse-cache-control` ships a LICENSE but omits the metadata field; missing a
top-level notice can also mean notices live in another directory. No default
MIT label is assigned. Browser fallback evidence is in
`browser-licence-fallbacks.json`; the exact version must match to use it.

## Provider settings and retention

| System | Verified fact | Not established by this review |
| --- | --- | --- |
| Railway production | Connected configuration: one replica in `asia-southeast1-eqsg3a`, mapped to Singapore by [Railway's region reference](https://docs.railway.com/deployments/regions); GitHub main source and healthcheck configured | Database location, all subprocessors, log retention, contracts or support access. A hosting region is not a claim that all data stays there. |
| Database | MySQL-compatible storage in code; previous isolated restore evidence preserved | Current TiDB account settings, backup expiry, point-in-time retention and access list were not accessible through a connected provider tool. |
| Resend | Configured mail integration and key name; code minimises terminal delivery payloads | Account retention, processing region, deletion SLA, mailbox monitoring. An API key's presence proves none of these. |
| Anthropic / OpenAI | Text questions go to Anthropic; OpenAI image integration exists; local speech blocks outbound model access | Organisation-specific retention/training settings, contractual exceptions and regional options. Generic provider documentation is not account evidence. |
| Cloudflare / Meta | Edge/publishing integrations already established | Zone-specific cookies/analytics/log settings and account processing settings; no applicable connected tools were available. |

No credentials or subscriber data were read to infer these settings. No privacy,
security or retention setting changed in external accounts.

Existing automated cleanup is narrower than a full retention policy: known-age
expired confirmation tokens, terminal delivery bodies and 30-day-old held
enrichment inputs are cleaned hourly. Web-vitals samples prune a 30-day window
on new writes. Raw `page_views`, feedback and consent evidence do not have an
approved universal expiry in the reviewed code. No arbitrary deletion schedule
was enabled. Owner approval must specify purpose, live retention, justified
suppression/consent evidence, legal holds, processor deletion and backup expiry.

## Accessibility verification and limits

Live pre-change Trends inspection confirmed the generic bar/treemap image labels
and lack of a full text alternative. More opens by keyboard, Escape closes it,
and focus returns to More after the close completes. No subscriber forms were
submitted or shares published. The new tables follow [W3C complex-image guidance](https://www.w3.org/WAI/tutorials/images/complex/):
make the detailed alternative available to everyone, not solely mouse users.

Component tests cover native disclosure, table names/headers, zero versus missing
values, tiny categories and all-zero layout. No screen-reader-device certification,
all-page/all-zoom contrast claim or audit of every historical media export is made.
Deployed verification and final CI results belong in the release PR.

## Remaining decisions/access, not hidden completions

1. Owner: verified legal operator/ABN and employment/contributor ownership facts.
2. Account access/evidence: provider retention, database backups, processing
   settings and who monitors privacy requests. Do not send credentials in chat.
3. Rights expertise/permissions: private publisher datasets, exact unresolved
   rental-workbook notices, historical outputs and binary redistribution scope.
4. Owner/legal approval: retention policy and any contracts/filings. These were
   not signed, purchased, submitted or accepted on the owner's behalf.
