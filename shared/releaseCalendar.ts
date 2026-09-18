/**
 * Housing-relevant official release calendar.
 *
 * The Desk already prints an edition's "dates to watch" as model-written prose.
 * This is the same job done as records: an official source, what it measures,
 * the period it observes, the date if one is confirmed, when The Desk last
 * checked, and a link to the publisher's own calendar so a reader can confirm it.
 *
 * The hard rule: **no date is ever inferred, estimated or generated.** An event
 * whose date The Desk has not read off the publisher's calendar carries
 * `when: { kind: "not-confirmed" }` and says so on the page. That is less
 * satisfying than a full grid of dates and it is the only version worth
 * publishing — a calendar whose dates might be invented is worse than no
 * calendar, because a reader cannot tell which entries to trust.
 *
 * Confirming a date is a reviewed change to this file: set `when` to a
 * `confirmed` entry with the Sydney date and time the publisher states, set
 * `confirmedFrom` to the page it was read from, and set `lastCheckedOn`. Nothing
 * here writes a date at runtime.
 */

type ReleaseWhen =
  /** A date and Sydney local time read off the publisher's own calendar. */
  | { kind: "confirmed"; date: string; time: string }
  /** The publisher states a period but not a date, e.g. "late October". */
  | { kind: "expected-window"; window: string }
  /** The Desk has not confirmed a date. Never a guess. */
  | { kind: "not-confirmed" }
  /** The publisher moved or withdrew a previously stated date. */
  | { kind: "postponed"; previousDate: string; note: string };

export type ReleaseEvent = {
  id: string;
  publisher: string;
  title: string;
  /** What the number actually measures, in one sentence a reader can use. */
  measures: string;
  /** The period the release observes, not the period it is published in. */
  observationPeriod: string;
  cadence: string;
  when: ReleaseWhen;
  /** The publisher's own schedule page. Always present: it is how a reader confirms. */
  sourceCalendarUrl: string;
  /** The page carrying the release itself. */
  sourceUrl: string;
  /** Where a confirmed date was read from. Null whenever `when` is not confirmed. */
  confirmedFrom: string | null;
  /** When a person last checked this entry against the publisher. */
  lastCheckedOn: string;
  /**
   * A metric The Desk already tracks, so the reader can see the last result it
   * holds beside the next release. Null when The Desk tracks nothing comparable.
   */
  metricKey: string | null;
};

/** After this long without a check, the entry is shown as needing re-checking. */
export const RELEASE_CHECK_STALE_DAYS = 45;

const RELEASE_CALENDAR_REVIEWED = "2026-09-18";

const ABS_CALENDAR = "https://www.abs.gov.au/release-calendar/future-releases";
const RBA_SMP = "https://www.rba.gov.au/publications/smp/";

/**
 * The releases that move housing coverage. Each is a standing, verifiable fact
 * about what the publisher produces; none of them asserts a date, because this
 * session could not open the publishers' calendars to read one. The reader gets
 * what it measures, what The Desk last recorded, and the link that settles the
 * date.
 */
export const RELEASE_EVENTS: ReleaseEvent[] = [
  {
    id: "abs-cpi",
    publisher: "Australian Bureau of Statistics",
    title: "Consumer Price Index, Australia",
    measures:
      "Price change for a fixed basket, including a rents series that measures rents actually paid by tenants — not advertised asking rents.",
    observationPeriod: "Quarter, with a monthly indicator series",
    cadence: "Quarterly, with monthly indicator releases",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "cpi_trimmed",
  },
  {
    id: "abs-building-approvals",
    publisher: "Australian Bureau of Statistics",
    title: "Building Approvals, Australia",
    measures:
      "Dwellings approved for construction. An approval permits building; it is not a start and not a completed home.",
    observationPeriod: "Month",
    cadence: "Monthly",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "building_approvals",
  },
  {
    id: "abs-building-activity",
    publisher: "Australian Bureau of Statistics",
    title: "Building Activity, Australia",
    measures:
      "Dwellings commenced, under construction and completed. This is the stage of delivery an approval count cannot tell you.",
    observationPeriod: "Quarter",
    cadence: "Quarterly",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: null,
  },
  {
    id: "abs-lending",
    publisher: "Australian Bureau of Statistics",
    title: "Lending Indicators",
    measures:
      "New housing loan commitments by borrower type. A commitment is new borrowing, not the total stock of mortgage debt.",
    observationPeriod: "Month",
    cadence: "Monthly",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/economy/finance/lending-indicators/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "owner_occupier_new_lending_rate",
  },
  {
    id: "abs-labour-force",
    publisher: "Australian Bureau of Statistics",
    title: "Labour Force, Australia",
    measures:
      "Employment and unemployment. Housing coverage uses it for household income capacity, not as a housing measure.",
    observationPeriod: "Month",
    cadence: "Monthly",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "unemployment",
  },
  {
    id: "abs-regional-population",
    publisher: "Australian Bureau of Statistics",
    title: "Regional Population",
    measures:
      "Population change by region, split into natural increase, internal migration and overseas migration.",
    observationPeriod: "Year ended 30 June",
    cadence: "Annual",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: ABS_CALENDAR,
    sourceUrl:
      "https://www.abs.gov.au/statistics/people/population/regional-population/latest-release",
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "net_migration",
  },
  {
    id: "rba-smp",
    publisher: "Reserve Bank of Australia",
    title: "Statement on Monetary Policy",
    measures:
      "The RBA's published assessment and its dated forecasts for growth, unemployment, wages and inflation. It does not forecast house prices or rents.",
    observationPeriod: "Forward-looking, published quarterly",
    cadence: "Quarterly",
    when: { kind: "not-confirmed" },
    sourceCalendarUrl: RBA_SMP,
    sourceUrl: RBA_SMP,
    confirmedFrom: null,
    lastCheckedOn: RELEASE_CALENDAR_REVIEWED,
    metricKey: "cash_rate",
  },
];

const SYDNEY = "Australia/Sydney";

function sydneyParts(instant: number): { asUtcMs: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  // Intl renders midnight as hour 24 in some ICU versions; normalise it.
  const hour = value("hour") % 24;
  return {
    asUtcMs: Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      hour,
      value("minute"),
      value("second")
    ),
  };
}

/**
 * The instant at which a Sydney wall clock reads `date` at `time`.
 *
 * Sydney runs daylight saving, so a fixed UTC offset is wrong for half the year
 * and a release "at 11:30am" is two different instants in January and July. This
 * resolves the offset at the candidate instant and re-solves, then checks the
 * answer by converting back: a wall-clock time inside the spring-forward gap
 * never happens, and returns null rather than being silently shifted an hour.
 */
export function sydneyInstant(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return null;
  let instant = target;
  for (let pass = 0; pass < 3; pass++) {
    const offset = sydneyParts(instant).asUtcMs - instant;
    const next = target - offset;
    if (next === instant) break;
    instant = next;
  }
  // Round-trip check: if the clock never reads this time on this date, say so.
  return sydneyParts(instant).asUtcMs === target ? instant : null;
}

export function formatSydney(instant: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

export type ReleaseView = {
  event: ReleaseEvent;
  /** Null unless the entry carries a confirmed date that resolves to a real instant. */
  instant: number | null;
  whenLabel: string;
  /** Plain English about how much to trust the date. */
  dateBasis: string;
  daysAway: number | null;
  past: boolean;
  /** True when nobody has checked this entry against the publisher recently. */
  needsRecheck: boolean;
};

function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / 86_400_000);
}

export function releaseView(event: ReleaseEvent, now: Date): ReleaseView {
  const nowMs = now.getTime();
  const checked = Date.parse(`${event.lastCheckedOn}T00:00:00Z`);
  const needsRecheck =
    !Number.isFinite(checked) || daysBetween(checked, nowMs) > RELEASE_CHECK_STALE_DAYS;

  let instant: number | null = null;
  let whenLabel: string;
  let dateBasis: string;

  switch (event.when.kind) {
    case "confirmed": {
      instant = sydneyInstant(event.when.date, event.when.time);
      whenLabel = instant === null ? "Stated time needs review" : formatSydney(instant);
      dateBasis =
        instant === null
          ? "The recorded time does not exist on that date in Sydney. Treat the date as unconfirmed until it is re-read from the publisher."
          : "Read from the publisher's own schedule. Publishers do move dates.";
      break;
    }
    case "expected-window":
      whenLabel = event.when.window;
      dateBasis =
        "The publisher has stated a window, not a date. The Desk has not converted it into one.";
      break;
    case "postponed":
      whenLabel = "Postponed";
      dateBasis = `Previously ${event.when.previousDate}. ${event.when.note}`;
      break;
    default:
      whenLabel = "Date not confirmed";
      dateBasis =
        "The Desk has not confirmed a date for this release and does not estimate one. Check the publisher's calendar.";
  }

  return {
    event,
    instant,
    whenLabel,
    dateBasis,
    daysAway: instant === null ? null : daysBetween(nowMs, instant),
    past: instant !== null && instant < nowMs,
    needsRecheck,
  };
}

/**
 * Confirmed upcoming dates first and soonest first, then everything without a
 * usable date in the order the calendar declares it. A release with no confirmed
 * date is still worth showing — it is what is coming, and where to confirm it —
 * so it is listed rather than hidden.
 */
export function releaseCalendar(now: Date, events: ReleaseEvent[] = RELEASE_EVENTS): ReleaseView[] {
  const views = events.map((event) => releaseView(event, now));
  const dated = views
    .filter((view) => view.instant !== null && !view.past)
    .sort((a, b) => a.instant! - b.instant!);
  const undated = views.filter((view) => view.instant === null || view.past);
  return [...dated, ...undated];
}

/** Reuse terms for the calendar itself, shown wherever it is published or exported. */
export const RELEASE_CALENDAR_TERMS =
  "The release dates and descriptions belong to the publishers named against each entry; follow their link for the authoritative schedule. The Desk's own compilation, wording and links may be reused with attribution to The Desk and a link back to this page.";
