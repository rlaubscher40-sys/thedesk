# Market opportunities addendum, 18 September 2026

A second workstream, separate from the competitive reader-quality audit recorded in
`docs/competitive-reader-quality-2026-09-18.md` and separate from the nine work
packages a concurrent session is implementing against
`The-Desk-Full-Audit-2026-09-18.md`. Nothing here restates or supersedes that work;
where the two touch the same file the change is additive and namespaced.

This addendum is the findings record for six candidate opportunities. They were
supplied as research-backed candidates, not as established gaps or proven demand.
Each was checked against what The Desk already does before anything was built.

## Working constraints found at the start

- **Egress.** This session's network policy blocks `api.apps1.nsw.gov.au`,
  `www.abs.gov.au`, `www.rba.gov.au`, `www.planningalerts.org.au` and `thedesk.au`.
  Design therefore had to work from evidence the application itself retains, and
  no figure in this workstream is transcribed from a page this session could not read.
  Production (Railway) is unaffected; it is the process that reads those sources.
- **The audit file.** `libfile_3bbc78131e8c81918f03f8ba35b393cf` is a Claude Library
  attachment and is not reachable from this container's filesystem or from the
  connected Drive account. The brief's own statement of the six opportunities, the
  repository's existing audit and coverage documents, and the code were used instead.
  Anything in the Library file that is not restated in the brief is not accounted for here.
- **Licensing.** PlanningAlerts' free API plan is restricted to non-commercial use,
  which The Desk is not. It is treated as a benchmark and an outbound link only; no
  PlanningAlerts data is retrieved, stored or republished.
  <https://www.planningalerts.org.au/api/howto>

## Mapping against current functionality

| #   | Opportunity                        | What already exists                                                                                                                                                                                                   | Genuine gap                                                                                                                                                                                         |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Project follow-through             | `server/planning/nswDa.ts` reads the free, CC-BY NSW Online DA API; `planning_snapshots` already retains an immutable dated vintage _and its per-application records_ on every read; Signals shows one council month. | Retained vintages are only ever read as a monthly aggregate. Nothing follows an individual application across reads, so a status change or a revised dwelling count is retained but never surfaced. |
| 2   | Ownership cost and downside        | `shared/loanRepaymentExample.ts` and `client/src/components/LoanRateScenario.tsx` compare two rates on one balance.                                                                                                   | No holding costs, no rent, no vacancy, no cash-flow result, no downside sensitivity, no due-diligence source list.                                                                                  |
| 3   | Forecast accountability            | Nothing.                                                                                                                                                                                                              | Real gap — but not implementable here; see below.                                                                                                                                                   |
| 4   | Reader questions                   | Ask (`/ask`) answers from retained evidence; the feedback inbox takes bug / idea / praise.                                                                                                                            | Neither is a coverage request. A reader cannot ask The Desk to _report_ something, and an answer cannot be linked back to the question that prompted it.                                            |
| 5   | Official-source release calendar   | Editions carry a model-written `datesToWatch` / `whatToWatch` string array; `shared/metricHealth.ts` holds operational refresh thresholds.                                                                            | No maintained, sourced, dated calendar; the edition strings are prose, not records, and the thresholds are review windows rather than publication dates.                                            |
| 6   | Reusable research and distribution | `/feed.xml` in `server/core/seo.ts` carries the last 50 editions.                                                                                                                                                     | No topic scoping and no machine-readable export of The Desk's own calculations with units, geography, period, source and reuse terms.                                                               |

## Ranking

Reader benefit / evidence availability / maintenance burden / overlap with the other workstream.

1. **Ownership cost and downside (2).** Highest benefit per unit of risk. All inputs
   come from the reader, the arithmetic is self-contained and independently checkable,
   and there is no ongoing source to maintain. No overlap.
2. **Project follow-through (1).** The strongest differentiator, and the evidence is
   already being retained and thrown away. Maintenance is bounded: it re-reads a source
   the pilot already reads, on a fixed cadence, for a fixed council. Its honest ceiling
   is the planning system — it cannot evidence construction or completion.
3. **Reader questions (4).** Low cost, extends two existing surfaces rather than adding
   a third. Its value depends on readers actually submitting, which is not yet evidenced.
4. **Release calendar (5).** Useful and maintainable, but only as good as the dates in
   it. Implemented so that an unconfirmed date is visibly unconfirmed rather than guessed.
5. **Reusable research (6).** Small and safe, but there is no evidence yet of demand
   for The Desk's data as data. Kept to the smallest useful extension.
6. **Forecast accountability (3).** Deferred. Reasons below.

## Why forecast accountability is deferred, not dismissed

- The primary forecasts are in the RBA's _Statement on Monetary Policy_, which this
  session cannot open. Building the tracker would mean transcribing forecast values
  from memory or from search summaries. Both are how a forecast tracker stops being
  evidence, so neither was done and no schema was seeded with placeholder numbers.
- The RBA's published forecast table covers GDP, unemployment, wages and inflation.
  It does not forecast dwelling prices, rents or approvals, so the measures The Desk
  reports on most are not the measures the most accessible forecaster publishes. A
  tracker of RBA unemployment forecasts is defensible, but it is a macro product, not
  a housing one, and the compatible-outcome rule bites hard: the ABS labour series is
  revised and seasonally re-estimated, so first-release and current values differ.
- A small number of forecasts from one forecaster cannot support a leaderboard, and
  the brief is explicit that it must not become one.

The condition for picking this up is narrow and checkable: direct access to the SMP
forecast table, a measure The Desk already retains first-release actuals for, and at
least eight assessable forecast/outcome pairs. Until then this stays a finding.

## Batch one: project follow-through and ownership cost

### Project follow-through (`/projects`)

The NSW planning pilot already stored an immutable dated vintage _and its
per-application records_ on every read, and only ever read them back as a monthly
aggregate. This follows individual applications across those retained reads. No new
source, no new API surface, no new table, no migration.

- `shared/projectFollowThrough.ts` — a stable identity (the planning portal
  application number), a dated milestone ladder, change detection across vintages,
  the "no newer evidence found" state, and the material-update feed for editorial.
- `server/planning/followThrough.ts` — assembles the read from retained vintages,
  and refreshes the tracked months. Fixed council, fixed cohort size, fixed
  whole-month windows: a public caller cannot widen or redirect the read.
- `server/db/planningSnapshots.ts` — a records reader alongside the existing
  snapshot reader.
- A weekly scheduler job (`planning-follow-through-refresh`, Tuesdays 04:20 Sydney)
  keeps the three complete months before the pilot month alive, so an application
  keeps being followed after its month rolls out of the pilot window. Three
  whole-month reads a week of a source that publishes daily, through the existing
  scheduler rather than a new one.
- `/projects`, with server-rendered method and limits, page metadata, a self
  canonical and a sitemap entry, linked from the Signals planning panel, the More
  menu and the housing-supply guide.

What it will not say, enforced by tests:

- **Never "approved".** The source publishes that a determination was made and its
  date. It does not publish the outcome, so the milestone is "Determination recorded".
  A `Rejected` or `Withdrawn` status is reported as that status, not as a determination.
- **Construction and completion stay "No evidence found".** No connected source
  reports either for an individual application.
- **A repeat check is not progress.** Identical evidence folds into one observation
  and the page says "No newer evidence found since …", with the last-checked date.
- **Dwelling counts are revised, not summed.** Each reported count replaces the last
  for that application. Modifications and reviews are excluded from the cohort
  entirely, because the source does not publish which application they modify.
- **Promised dates have a place and no data.** The milestone shape carries a
  `promised` basis for an editorially cited announcement. Nothing derives one from
  this feed.

### Ownership cash flow (on `/guides/interest-rates`)

`shared/ownershipCashFlow.ts` extends the existing repayment illustration — same
`monthlyRepayment`, same assumptions — into a full pre-tax year.

- Reader-entered rent, vacancy weeks, management fee, council rates, insurance,
  maintenance and strata. Every input is bounded and no result is shown while one is
  missing or out of range.
- First-year interest and principal are amortised month by month, not approximated.
  The worked example's figures were checked against a 40-digit decimal amortisation:
  monthly 3597.3031509165…, first-year interest 35,799.5675…, principal 7,368.0702…
- Two results, deliberately: net cash flow (what leaves the account) and the same
  figure with principal added back (because principal moved into equity, it was not
  consumed). Neither is a return: nothing here values the property.
- Four fixed downside shifts — rate one point higher, rent 10% lower, two more vacant
  weeks, all three at once — labelled as what-ifs, not probabilities.
- Six stated exclusions, tax first.
- A due-diligence section linking official records: the NSW Planning Portal Spatial
  Viewer, the Service NSW planning certificate, NSW Online DA open data, Geoscience
  Australia flood and bushfire, ABS Building Activity and ASIC Moneysmart — plus the
  Climate Council risk map, labelled as suburb-level research modelling rather than a
  government record. The page states in terms that The Desk does not rate an address,
  price a risk or quote insurance, and that suburb modelling is not a property rating.

The planning records are New South Wales because that is where The Desk's planning
reporting is checked; the page says so rather than implying national coverage.

## Batch two: reader questions, the release calendar, and reusable research

### Coverage requests (opportunity 4)

Extends the two surfaces that already exist rather than adding a third form.
Ask answers from evidence The Desk holds; a coverage request is the other case —
the reader wants reporting that does not exist yet.

- A fourth kind, "Cover this", on the existing feedback button, with three fixed
  categorisation selects: topic, geography and reader task. The reader tasks are
  the same three positions the voice rules already use (buying, holding, watching).
- Migration `0030_reader_coverage_requests.sql` adds five columns to
  `feedback_submissions`, with matching boot catch-up statements; `catchup.test.ts`
  enforces the pairing.
- An editorial triage panel in the admin overview: counts by topic, place and
  reader task; an outcome per request including "Not covering"; and a field that
  links the published answer back to the request that prompted it.
- The Ask page now says what Ask is for and what a coverage request is for, and
  states that what a reader types into Ask is not treated as a coverage request.

Privacy, enforced in code and in tests:

- Categorisation is a fixed list, never free text, so triage does not become a
  second store of whatever someone typed about a person or an address.
- `publicRequestShape` is the only shape of a request that may leave the inbox:
  categories and outcome. No message, no contact details, no page URL, no user
  agent, no timestamp. Even that is not published anywhere automatically.
- A published answer must be one of The Desk's own published routes. An arbitrary
  URL is refused rather than stored, and any outcome other than "answered" clears
  the link, so a link cannot be left behind on a request that was later declined.
- Categories sent with a bug report are discarded rather than quietly promoting it
  to a coverage request.

The panel says on its face that these are self-selected submissions from readers
who happened to be on the site, not a representative sample, and that an empty
inbox is an empty inbox rather than evidence of no demand. No submissions were
invented to demonstrate it.

### Official-source release calendar (opportunity 5)

`shared/releaseCalendar.ts` turns the edition's model-written "dates to watch"
prose into records: publisher, what the release measures, the period it observes,
its cadence, the date if one is confirmed, when a person last checked, and the
publisher's own schedule link. It appears on `/signals` under the planning pilot.

**No date is inferred, estimated or generated.** Every seeded entry ships as
`not-confirmed` and says so on the page, because this session's network policy
blocked `abs.gov.au` and `rba.gov.au` and no date could be read off a publisher's
calendar. A test asserts that every seeded entry is unconfirmed, so a future
change cannot quietly add a plausible date without also carrying the source it was
read from. Confirming one is a reviewed change to the file.

The DST handling is real rather than nominal. `sydneyInstant` resolves a Sydney
wall clock to an instant by solving for the offset at the candidate instant and
checking the answer by converting back, so:

- 11:30am resolves to 01:30Z in July and 00:30Z in January;
- both sides of each changeover resolve correctly;
- a time inside the spring-forward gap — 2:30am on the first Sunday in October —
  returns null and the page says the recorded time needs review, rather than being
  silently shifted an hour.

Postponements and stated windows are distinct states with their own wording, and
an entry nobody has checked for 45 days is marked as due for re-checking.

Each entry links to the last result The Desk already holds for that measure, drawn
from the existing metrics store, with the line that the next release replaces that
figure rather than adding to it.

No calendar export ships. An .ics file of entries with no confirmed dates would be
an empty file with a download button; the export becomes worth building the moment
the first date is confirmed.

### Topic feeds and the calendar as data (opportunity 6)

`/feed.xml` was inspected first: it carries the last 50 editions, which is the
weekly product, and it is left alone. The smallest useful extension was the one
missing thing — a reader who wants only the daily property reporting.

- `/feeds/{property,policy,markets,economy}.xml`: the same published items the
  archive already shows, scoped to one category, 50 items, linked from the footer.
  Held items cannot reach them (the archive query already excludes `HOLD`), the
  excerpt goes through the same publisher-promotion cleaning as the site, and each
  item links to The Desk's story page, where the original publisher is credited.
  No publisher's article body is republished. An unknown topic is a 404 and an
  unavailable archive is a 503 — never an empty feed that reads like no coverage.
- `/research/release-calendar.csv`: The Desk's own compilation, with publisher,
  what it measures, geography, unit, observation period, cadence, date status,
  confirmed time and its provenance, last-checked date, both source links and the
  reuse terms on every row. `date_status` reads `not-confirmed` and the scheduled
  column is empty, rather than a blank that could be mistaken for a date.
- Every CSV field is quoted and a leading `=`, `+`, `-` or `@` is neutralised, so a
  description containing a comma cannot add a column and no cell executes as a
  spreadsheet formula.
- The reuse terms are deliberately narrow: The Desk licenses its own compilation
  for reuse with attribution, and says plainly that the underlying releases belong
  to the publishers named in the source column and are governed by their terms.

No separate "use and cite our research" page was built. The terms travel with the
file and with the calendar, which is where someone deciding whether they may reuse
it is actually looking; a page that repeats them would be a third place to keep in
sync. No outreach was sent and nothing was posted anywhere.
