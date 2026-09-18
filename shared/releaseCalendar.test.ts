import { describe, expect, it } from "vitest";
import {
  RELEASE_CALENDAR_TERMS,
  RELEASE_CHECK_STALE_DAYS,
  RELEASE_EVENTS,
  formatSydney,
  releaseCalendar,
  releaseView,
  sydneyInstant,
  type ReleaseEvent,
} from "./releaseCalendar";

const base: ReleaseEvent = {
  id: "test",
  publisher: "Australian Bureau of Statistics",
  title: "A release",
  measures: "Something measurable.",
  observationPeriod: "Month",
  cadence: "Monthly",
  when: { kind: "not-confirmed" },
  sourceCalendarUrl: "https://www.abs.gov.au/release-calendar/future-releases",
  sourceUrl: "https://www.abs.gov.au/",
  confirmedFrom: null,
  lastCheckedOn: "2026-09-18",
  metricKey: null,
};

describe("Sydney wall clock to instant", () => {
  it("resolves the same clock time to different instants across daylight saving", () => {
    // AEST (UTC+10) in July; AEDT (UTC+11) in January.
    const winter = sydneyInstant("2026-07-15", "11:30")!;
    const summer = sydneyInstant("2026-01-15", "11:30")!;
    expect(new Date(winter).toISOString()).toBe("2026-07-15T01:30:00.000Z");
    expect(new Date(summer).toISOString()).toBe("2026-01-15T00:30:00.000Z");
  });

  it("is correct on both sides of each changeover", () => {
    // Sydney moves to AEDT at 2am on the first Sunday in October, and back at
    // 3am on the first Sunday in April.
    expect(new Date(sydneyInstant("2026-10-03", "11:30")!).toISOString()).toBe(
      "2026-10-03T01:30:00.000Z"
    );
    expect(new Date(sydneyInstant("2026-10-05", "11:30")!).toISOString()).toBe(
      "2026-10-05T00:30:00.000Z"
    );
    expect(new Date(sydneyInstant("2026-04-04", "11:30")!).toISOString()).toBe(
      "2026-04-04T00:30:00.000Z"
    );
    expect(new Date(sydneyInstant("2026-04-06", "11:30")!).toISOString()).toBe(
      "2026-04-06T01:30:00.000Z"
    );
  });

  it("refuses a wall-clock time that never happens, instead of shifting it", () => {
    // 2:30am on the spring-forward Sunday does not exist in Sydney.
    expect(sydneyInstant("2026-10-04", "02:30")).toBeNull();
    // The hour either side of the gap does exist.
    expect(sydneyInstant("2026-10-04", "01:30")).not.toBeNull();
    expect(sydneyInstant("2026-10-04", "03:30")).not.toBeNull();
  });

  it("resolves an ambiguous autumn hour to a single real instant", () => {
    // 2:30am occurs twice on the fall-back Sunday; one instant is returned and
    // it really does read 02:30 in Sydney.
    const instant = sydneyInstant("2026-04-05", "02:30")!;
    expect(instant).not.toBeNull();
    expect(formatSydney(instant)).toContain("2:30");
  });

  it("rejects malformed input rather than guessing", () => {
    for (const [date, time] of [
      ["2026-13-01", "11:30"],
      ["not-a-date", "11:30"],
      ["2026-07-15", "11:3"],
      ["2026-07-15", "1130"],
      ["", ""],
    ])
      expect(sydneyInstant(date!, time!)).toBeNull();
  });
});

describe("how much to trust a date", () => {
  const now = new Date("2026-09-18T04:00:00.000Z");

  it("says plainly when The Desk has not confirmed one", () => {
    const view = releaseView(base, now);
    expect(view.whenLabel).toBe("Date not confirmed");
    expect(view.dateBasis).toContain("does not estimate one");
    expect(view.instant).toBeNull();
    expect(view.daysAway).toBeNull();
  });

  it("carries a confirmed date with the caveat that publishers move dates", () => {
    const view = releaseView(
      { ...base, when: { kind: "confirmed", date: "2026-10-28", time: "11:30" } },
      now
    );
    expect(view.instant).not.toBeNull();
    expect(view.dateBasis).toContain("publisher's own schedule");
    expect(view.dateBasis).toContain("do move dates");
    expect(view.daysAway).toBe(40);
    expect(view.past).toBe(false);
  });

  it("does not silently accept a stated time that cannot exist", () => {
    const view = releaseView(
      { ...base, when: { kind: "confirmed", date: "2026-10-04", time: "02:30" } },
      now
    );
    expect(view.instant).toBeNull();
    expect(view.whenLabel).toBe("Stated time needs review");
    expect(view.dateBasis).toContain("does not exist on that date");
  });

  it("reports a window as a window and a postponement as a postponement", () => {
    const windowed = releaseView(
      { ...base, when: { kind: "expected-window", window: "Late October 2026" } },
      now
    );
    expect(windowed.whenLabel).toBe("Late October 2026");
    expect(windowed.dateBasis).toContain("has not converted it into one");

    const postponed = releaseView(
      {
        ...base,
        when: {
          kind: "postponed",
          previousDate: "2026-09-10",
          note: "Withdrawn by the publisher.",
        },
      },
      now
    );
    expect(postponed.whenLabel).toBe("Postponed");
    expect(postponed.dateBasis).toContain("Previously 2026-09-10");
  });

  it("flags an entry nobody has checked lately", () => {
    expect(releaseView(base, now).needsRecheck).toBe(false);
    const stale = new Date(now.getTime() + (RELEASE_CHECK_STALE_DAYS + 2) * 86_400_000);
    expect(releaseView(base, stale).needsRecheck).toBe(true);
    expect(releaseView({ ...base, lastCheckedOn: "nonsense" }, now).needsRecheck).toBe(true);
  });
});

describe("the calendar", () => {
  const now = new Date("2026-09-18T04:00:00.000Z");

  it("puts confirmed upcoming dates first, soonest first", () => {
    const views = releaseCalendar(now, [
      { ...base, id: "later", when: { kind: "confirmed", date: "2026-11-05", time: "11:30" } },
      { ...base, id: "undated" },
      { ...base, id: "sooner", when: { kind: "confirmed", date: "2026-10-01", time: "11:30" } },
      { ...base, id: "past", when: { kind: "confirmed", date: "2026-08-01", time: "11:30" } },
    ]);
    expect(views.map((view) => view.event.id)).toEqual(["sooner", "later", "undated", "past"]);
  });

  it("still lists a release with no confirmed date, rather than hiding it", () => {
    const views = releaseCalendar(now, [base]);
    expect(views).toHaveLength(1);
    expect(views[0]!.whenLabel).toBe("Date not confirmed");
  });

  it("ships no invented dates: every seeded entry is unconfirmed and links its publisher", () => {
    expect(RELEASE_EVENTS.length).toBeGreaterThan(4);
    for (const event of RELEASE_EVENTS) {
      expect(event.when.kind).toBe("not-confirmed");
      expect(event.confirmedFrom).toBeNull();
      expect(event.sourceCalendarUrl.startsWith("https://")).toBe(true);
      expect(event.sourceUrl.startsWith("https://")).toBe(true);
      expect(event.measures.length).toBeGreaterThan(30);
      expect(event.observationPeriod.length).toBeGreaterThan(0);
      expect(event.lastCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps a confirmed date and its provenance together", () => {
    // A confirmed date without a source it was read from is the thing this
    // calendar exists to prevent, so the shape makes the pairing explicit.
    const confirmed: ReleaseEvent = {
      ...base,
      when: { kind: "confirmed", date: "2026-10-28", time: "11:30" },
      confirmedFrom: "https://www.abs.gov.au/release-calendar/future-releases",
    };
    expect(releaseView(confirmed, now).instant).not.toBeNull();
    expect(confirmed.confirmedFrom).not.toBeNull();
  });

  it("states reuse terms that separate the publishers' work from The Desk's", () => {
    expect(RELEASE_CALENDAR_TERMS).toContain("belong to the publishers");
    expect(RELEASE_CALENDAR_TERMS).toContain("attribution to The Desk");
  });

  it("says what the RBA statement does and does not forecast", () => {
    const smp = RELEASE_EVENTS.find((event) => event.id === "rba-smp")!;
    expect(smp.measures).toContain("does not forecast house prices");
  });
});
