import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ReleaseCalendarRead } from "./ReleaseCalendarRead";
import { RELEASE_EVENTS, type ReleaseEvent } from "./releaseCalendar";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

const now = new Date("2026-09-18T04:00:00.000Z");

function render(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(React.createElement(ReleaseCalendarRead, { now, ...props }));
}

describe("release calendar panel", () => {
  it("lists every release with what it measures and where to confirm the date", () => {
    const html = render();
    for (const event of RELEASE_EVENTS) {
      expect(html).toContain(event.title);
      expect(html).toContain(event.publisher);
      expect(html).toContain(event.sourceCalendarUrl);
    }
    expect(html).toContain("does not estimate it");
  });

  it("says a date is not confirmed rather than showing a plausible one", () => {
    const html = render();
    expect(html).toContain("Date not confirmed");
    expect(html).toContain("does not estimate one");
    // No month-and-day pattern should appear as a release date anywhere.
    expect(html).not.toMatch(/in \d+ days/);
  });

  it("shows a confirmed date in Sydney time with its caveat", () => {
    const events: ReleaseEvent[] = [
      {
        ...RELEASE_EVENTS[0]!,
        when: { kind: "confirmed", date: "2026-10-28", time: "11:30" },
        confirmedFrom: "https://www.abs.gov.au/release-calendar/future-releases",
      },
    ];
    const html = render({ events });
    expect(html).toContain("11:30");
    expect(html).toContain("in 40 days");
    expect(html).toContain("publisher&#x27;s own schedule");
  });

  it("shows the last result The Desk holds as a replacement, not an addition", () => {
    const html = render({
      metrics: [
        {
          metricKey: "cpi_trimmed",
          label: "Trimmed mean CPI",
          value: "2.8",
          unit: "%",
          asOf: "2026-06-30T00:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("Last result The Desk holds");
    expect(html).toContain("2.8%");
    expect(html).toContain("30 June 2026");
    expect(html).toContain("replaces it; it does not add to it");
  });

  it("omits the last result rather than inventing one when nothing is held", () => {
    const html = render({ metrics: [] });
    expect(html).not.toContain("Last result The Desk holds");
  });

  it("marks an entry nobody has checked lately", () => {
    const stale = new Date("2027-06-01T00:00:00.000Z");
    const html = renderToStaticMarkup(React.createElement(ReleaseCalendarRead, { now: stale }));
    expect(html).toContain("due for re-checking");
  });

  it("separates the publishers' rights from The Desk's own compilation", () => {
    const html = render();
    expect(html).toContain("belong to the publishers");
    expect(html).toContain("attribution to The Desk");
  });
});
